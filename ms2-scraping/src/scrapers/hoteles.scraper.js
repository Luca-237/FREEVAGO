import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const BRAVE_PATH = process.env.BRAVE_PATH || '/opt/brave.com/brave-origin/brave';

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
