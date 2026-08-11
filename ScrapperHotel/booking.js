import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as readline from 'readline';

puppeteer.use(StealthPlugin());

const BRAVE_PATH = '/opt/brave.com/brave-origin/brave';

// Función para parsear la data de un hotel (basado en texto)
function parseHotelData(hotelText) {
    const lines = hotelText.split('\n').map(l => l.trim()).filter(l => l);
    // Intentamos buscar el precio, nombre y puntuación
    // El precio suele tener símbolos como $, €, ARS, USD
    const priceLine = lines.find(l => l.includes('$') || l.includes('ARS') || l.includes('€') || l.includes('USD')) || 'Precio no encontrado';
    
    // El nombre usualmente es la primera o segunda línea que no sea un tag promocional
    let name = lines[0];
    if (name && (name.toLowerCase().includes('oferta') || name.toLowerCase().includes('patrocinado'))) {
        name = lines[1] || name;
    }

    // Buscar una puntuación (ej. 8.5, 9.0)
    const ratingRegex = /^[0-9](,[0-9]|[.,][0-9])?$/;
    const ratingLine = lines.find(l => ratingRegex.test(l)) || 'N/A';

    return {
        name,
        price: priceLine,
        rating: ratingLine,
        rawText: hotelText.replace(/\n/g, ' | ')
    };
}

export async function performScrape(destination, checkin, checkout, adults, logFunction = console.log) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: BRAVE_PATH,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        const page = await browser.newPage();
        
        // Optimizar carga bloqueando recursos innecesarios
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        const baseUrl = 'https://www.booking.com/searchresults.es.html';
        let searchUrl = `${baseUrl}?ss=${encodeURIComponent(destination)}&group_adults=${adults}&no_rooms=1&group_children=0`;
        if (checkin && checkout) {
            searchUrl += `&checkin=${checkin}&checkout=${checkout}`;
        }
        
        logFunction(`\n[Scraper] Navegando a: ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        logFunction(`[Scraper] Esperando resultados...`);
        // Dar tiempo para que pase el cloudflare/aws waf o cargue el DOM
        await new Promise(r => setTimeout(r, 12000));
        
        const extraction = await page.evaluate(() => {
            // Intentar encontrar las tarjetas de propiedad usando selectores comunes de Booking o atributos
            const selectors = [
                'div[data-testid="property-card"]',
                '.sr_property_block',
                'div[data-component="hotel-card"]'
            ];
            
            let cards = [];
            for (const selector of selectors) {
                const found = document.querySelectorAll(selector);
                if (found.length > 0) {
                    cards = Array.from(found);
                    break;
                }
            }
            
            // Fallback: buscar divs que contengan texto con símbolo de moneda y cierta longitud
            if (cards.length === 0) {
                const allDivs = document.querySelectorAll('div');
                const priceRegex = /[$€£]\s?\d+([.,]\d+)?|ARS\s?\d+/;
                
                cards = Array.from(allDivs).filter(div => {
                    const text = div.innerText || '';
                    // Booking property cards suelen tener más de 50 caracteres, contienen precio y el botón "Ver disponibilidad" o "Ver opciones" o "Mostrar precios"
                    return text.length > 50 && text.length < 1000 && priceRegex.test(text) && 
                           (text.toLowerCase().includes('ver disponibilidad') || text.toLowerCase().includes('ver opciones') || text.toLowerCase().includes('mostrar precios'));
                });
            }
            
            if (cards.length === 0) return { success: false, data: [] };

            const results = [];
            const seen = new Set();
            
            cards.forEach(card => {
                const textInfo = card.innerText || '';
                if (textInfo && (textInfo.includes('$') || textInfo.includes('ARS') || textInfo.includes('USD') || textInfo.includes('€'))) {
                    // Limpiar y evitar duplicados
                    if (!seen.has(textInfo)) { 
                        seen.add(textInfo); 
                        results.push(textInfo); 
                    }
                }
            });
            return { success: true, data: results };
        });

        if (!extraction.success || extraction.data.length === 0) {
            return { error: 'No se encontraron hoteles en la página (posible bloqueo WAF o selectores no válidos).' };
        }

        const parsedHotels = extraction.data.slice(0, 15).map(f => parseHotelData(f));
        
        return {
            destination: destination,
            checkin,
            checkout,
            resultsFound: parsedHotels.length,
            hotels: parsedHotels
        };

    } catch (error) {
        return { error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

// --- 1. MODO CONSOLA INTERACTIVA ---
async function runInteractiveConsole() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n--- MODO CONSOLA: Scraper de Booking (Hoteles) ---');
    const destination = await askQuestion('Destino (ej. Villa Carlos Paz, Argentina): ');
    const checkin = await askQuestion('Fecha de Check-in (ej. 2026-08-12): ');
    const checkout = await askQuestion('Fecha de Check-out (ej. 2026-08-13): ');
    const adults = await askQuestion('Cantidad de adultos (ej. 1): ');
    rl.close();

    console.log('\nIniciando búsqueda...');
    const result = await performScrape(destination, checkin, checkout, adults, console.log);
    
    if (result.error) {
        console.log(`\n[ERROR FINAL] ${result.error}`);
        return;
    }

    console.log(`\n======================================================`);
    console.log(`RESULTADOS FINALES: ${result.resultsFound} opciones encontradas`);
    console.log(`======================================================`);

    result.hotels.forEach((hotelObj, idx) => {
        let output = `\nOPCIÓN ${idx + 1}\nNombre aprox: ${hotelObj.name}\nPrecio: ${hotelObj.price}\nPuntuación: ${hotelObj.rating}\nTexto crudo: ${hotelObj.rawText.substring(0, 120)}...\n`;
        console.log(output);
    });
}

// --- 2. MODO SERVIDOR API ---
function runApiServer() {
    const app = express();
    const PORT = 3001; // Usamos puerto diferente por si corre a la vez que el de vuelos
    app.use(express.json());

    // Endpoint por destino
    app.get('/api/hoteles/destino', async (req, res) => {
        const { destination, adults = 1 } = req.query;
        if (!destination) {
            return res.status(400).json({ error: "Falta parámetro: destination" });
        }
        
        console.log(`\n[API] Petición recibida (Solo destino): ${destination}`);
        const result = await performScrape(destination, null, null, adults, (msg) => console.log(msg));

        if (result.error) {
            return res.status(404).json({ error: result.error });
        }
        res.json({ status: "success", ...result });
    });

    // Endpoint por fecha
    app.get('/api/hoteles/fecha', async (req, res) => {
        const { destination, checkin, checkout, adults = 1 } = req.query;
        if (!destination || !checkin || !checkout) {
            return res.status(400).json({ error: "Faltan parámetros: destination, checkin, checkout" });
        }
        
        console.log(`\n[API] Petición recibida (Con fechas): ${destination} (${checkin} al ${checkout})`);
        const result = await performScrape(destination, checkin, checkout, adults, (msg) => console.log(msg));

        if (result.error) {
            return res.status(404).json({ error: result.error });
        }
        res.json({ status: "success", ...result });
    });

    app.listen(PORT, () => {
        console.log(`Servidor API de Hoteles iniciado en http://localhost:${PORT}`);
        console.log(`Ejemplo Destino: http://localhost:${PORT}/api/hoteles/destino?destination=Miami`);
        console.log(`Ejemplo Fecha:   http://localhost:${PORT}/api/hoteles/fecha?destination=Miami&checkin=2026-08-12&checkout=2026-08-13`);
    });
}

// --- MENÚ PRINCIPAL ---
const rlMain = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log('\n=============================================');
console.log(' SELECCIONA EL MODO DE EJECUCIÓN DEL SCRAPER HOTELES');
console.log('=============================================');
console.log(' 1. Modo Consola (Interactivo)');
console.log(' 2. Servidor API REST');
rlMain.question('\nIngresa 1 o 2: ', (answer) => {
    rlMain.close();
    if (answer.trim() === '1') {
        runInteractiveConsole();
    } else if (answer.trim() === '2') {
        runApiServer();
    } else {
        console.log('Opción inválida. Saliendo...');
    }
});
