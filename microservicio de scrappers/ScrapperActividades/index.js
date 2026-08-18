import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as readline from 'readline';

puppeteer.use(StealthPlugin());

const BRAVE_PATH = '/opt/brave.com/brave-origin/brave';

// Normalizar texto (quitar tildes y pasar a minúsculas) para comparaciones
const normalizeText = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// --- FUNCIÓN PARA AUTOCOMPLETADO DE DESTINO ---
export async function fetchSugerenciasDestino(page, query) {
    const results = await page.evaluate(async (q) => {
        try {
            // 1. Buscar ciudades con la API de fullLocation
            const res = await fetch('https://api.turismocity.com/flights/fullLocation/AR?&departure=NONE&query=' + encodeURIComponent(q));
            const data = await res.json();
            
            // 2. Extraer ciudades únicas (Airport tiene campo city y country)
            // Guardamos también el código IATA (preferimos el tipo 'City' sobre 'Airport')
            const citiesMap = new Map();
            for (const item of data) {
                if (!item.city || !item.country) continue;
                const key = item.city + '_' + item.country;
                if (!citiesMap.has(key)) {
                    citiesMap.set(key, { city: item.city, country: item.country, iata: item.iata });
                } else if (item.type === 'City' && citiesMap.get(key).type !== 'City') {
                    // Si encontramos un tipo City, preferirlo (tiene el código de ciudad, no de aeropuerto individual)
                    citiesMap.set(key, { city: item.city, country: item.country, iata: item.iata });
                }
            }
            
            // 3. Para cada ciudad, construir slug y validar con GraphQL city()
            const validated = [];
            for (const [, { city, country, iata }] of citiesMap) {
                // Construir slug: quitar tildes, reemplazar espacios con _
                const slugCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
                const slugCountry = country.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
                const slug = slugCity + '_' + slugCountry;
                
                try {
                    const gqlQuery = 'query($slug: String!, $iso: String!) { city(slug: $slug, iso: $iso) { id name slug searchname country { name } } }';
                    const gqlUrl = 'https://api.turismocity.com/graphql-cdn?query=' + encodeURIComponent(gqlQuery) + '&variables=' + encodeURIComponent(JSON.stringify({iso: "AR", slug: slug}));
                    const gqlRes = await fetch(gqlUrl);
                    const gqlData = await gqlRes.json();
                    
                    if (gqlData.data && gqlData.data.city) {
                        const c = gqlData.data.city;
                        validated.push({
                            displayName: c.searchname || (c.name + ', ' + c.country.name),
                            slug: c.slug,
                            cityName: c.name,
                            countryName: c.country.name,
                            iata: iata
                        });
                    }
                } catch (e) {
                    // Si falla la validación, simplemente lo omitimos
                }
            }
            
            return validated;
        } catch (e) {
            return [];
        }
    }, query);
    
    return results;
}

// --- FUNCIÓN DE SCRAPING TURISMOCITY ---
export async function performScrape(page, destinationSlug, logFunction = console.log) {
    const searchUrl = `https://www.turismocity.com.ar/actividades-en-${destinationSlug}`;
    logFunction(`\n[Scraper] Navegando a: ${searchUrl}`);
    
    try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (navError) {
        return { error: `Falló navegación: ${navError.message}` };
    }
    
    logFunction(`[Scraper] Esperando carga de actividades...`);
    await new Promise(r => setTimeout(r, 15000));
    
    const extraction = await page.evaluate(() => {
        const results = [];
        const cards = Array.from(document.querySelectorAll('.tc-activities-card'));
        const seen = new Set();
        
        cards.forEach(card => {
            const text = card.innerText || '';
            if (text.length < 20) return;
            
            // Encontrar el precio buscando el contenedor de proveedor cercano
            let priceText = 'No encontrado';
            let currentElem = card;
            let providerContainer = null;
            
            for (let i = 0; i < 3; i++) {
                if (currentElem.parentElement) {
                    currentElem = currentElem.parentElement;
                    providerContainer = currentElem.querySelector('.tc-item-provider-container') || currentElem.querySelector('.tc-activities-price');
                    if (providerContainer) {
                        priceText = providerContainer.innerText;
                        break;
                    }
                }
            }
            
            if (priceText === 'No encontrado') {
                const priceRegex = /\$\s?\d{1,3}(?:\.\d{3})*/;
                const match = currentElem.innerText.match(priceRegex);
                if (match) priceText = match[0];
            } else {
                const priceMatch = priceText.match(/\$\s?\d{1,3}(?:\.\d{3})*/);
                if (priceMatch) priceText = priceMatch[0];
                else priceText = priceText.split('\n')[0];
            }

            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            const title = lines[0] || 'Sin título';
            
            if (seen.has(title)) return;
            seen.add(title);
            
            // Extraer duración
            const durationRegex = /\d+\s*(hs|h\s|h$|m\s|m$|min)/i;
            const durationLine = lines.find(l => durationRegex.test(l));
            const duracion = durationLine || 'No especificada';
            
            // Franja horaria
            let franjaHoraria = 'No especificada';
            const franjaRegex = /\d{1,2}:\d{2}\s*(hs|am|pm)/i;
            const franjaLine = lines.find(l => franjaRegex.test(l));
            if (franjaLine) franjaHoraria = franjaLine;

            // Descripción
            const descLines = lines.slice(1).filter(l => l.length > 30 && !durationRegex.test(l) && !franjaRegex.test(l));
            const descripcion = descLines.length > 0 
                ? descLines.join(' ').substring(0, 200) + (descLines.join(' ').length > 200 ? '...' : '')
                : 'Sin descripción disponible';

            results.push({
                origen: 'Turismocity',
                titulo: title,
                duracionEstimada: duracion,
                franjaHoraria: franjaHoraria,
                precioPorPersona: priceText,
                descripcionBreve: descripcion
            });
        });
        
        return { success: results.length > 0, data: results };
    });

    if (!extraction.success || extraction.data.length === 0) {
        return { error: 'No se encontraron actividades para este destino en Turismocity.' };
    }
    
    return {
        destination: destinationSlug,
        resultsFound: extraction.data.length,
        activities: extraction.data.slice(0, 15)
    };
}

// --- FUNCIÓN DE SCRAPING CIVITATIS ---
export async function performCivitatisScrape(page, cityName, countryName, logFunction = console.log) {
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '-');
    const citySlug = normalize(cityName);
    const countrySlug = normalize(countryName);
    
    // Forzar la moneda ARS para que dimension32 extraiga correctamente el valor en pesos
    try {
        await page.setCookie({
            name: 'currency',
            value: 'ARS',
            domain: '.civitatis.com'
        });
    } catch(e) {}
    
    let url = `https://www.civitatis.com/ar/${citySlug}-${countrySlug}/?currency=ARS`;
    logFunction(`\n[Civitatis] Probando URL: ${url}`);
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        let currentUrl = page.url();
        
        // Civitatis suele redirigir quitando los parámetros o hacia la home
        if (currentUrl.split('?')[0] === 'https://www.civitatis.com/ar/' || currentUrl.split('?')[0] === 'https://www.civitatis.com/ar') {
            url = `https://www.civitatis.com/ar/${citySlug}/?currency=ARS`;
            logFunction(`[Civitatis] Redirección detectada. Probando URL corta: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            currentUrl = page.url();
            
            if (currentUrl.split('?')[0] === 'https://www.civitatis.com/ar/' || currentUrl.split('?')[0] === 'https://www.civitatis.com/ar') {
                const words = citySlug.split('-');
                if (words.length > 1) {
                    url = `https://www.civitatis.com/ar/${words[words.length - 1]}/?currency=ARS`;
                    logFunction(`[Civitatis] Probando última palabra: ${url}`);
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    currentUrl = page.url();
                }
                
                if (currentUrl.split('?')[0] === 'https://www.civitatis.com/ar/' || currentUrl.split('?')[0] === 'https://www.civitatis.com/ar') {
                    logFunction(`[Civitatis] No se encontró la página para este destino.`);
                    return { success: false, data: [] };
                }
            }
        }
        
        logFunction(`[Civitatis] Página encontrada. Extrayendo actividades...`);
        await new Promise(r => setTimeout(r, 5000));
        
        const extraction = await page.evaluate(() => {
            const results = [];
            const articles = Array.from(document.querySelectorAll('article'));
            const seen = new Set();
            
            articles.forEach(article => {
                const text = article.innerText || '';
                if (text.length < 30) return;
                
                const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                
                // En Civitatis el título suele ser la línea después de "like", "10", o algún badge
                let titleIdx = 0;
                while (titleIdx < lines.length && (lines[titleIdx].toLowerCase() === 'like' || lines[titleIdx] === '10' || lines[titleIdx].includes('TOP') || lines[titleIdx] === '')) {
                    titleIdx++;
                }
                const title = lines[titleIdx] || 'Sin título';
                
                if (seen.has(title)) return;
                seen.add(title);
                
                // Buscar precio ("US$", "ARS", "Gratis", "Desde")
                let priceText = 'No especificado';
                
                // Nuevo método: leer dimension32 del JSON en data-gtm-new-model-click
                const linkElement = article.querySelector('a[data-gtm-new-model-click]');
                if (linkElement) {
                    try {
                        const gtmData = JSON.parse(linkElement.getAttribute('data-gtm-new-model-click'));
                        if (gtmData && gtmData.ecommerce && gtmData.ecommerce.click && gtmData.ecommerce.click.products && gtmData.ecommerce.click.products.length > 0) {
                            const product = gtmData.ecommerce.click.products[0];
                            if (product.dimension32 !== undefined) {
                                // Formatear el precio como ARS
                                priceText = 'ARS $ ' + product.dimension32.toLocaleString('es-AR');
                            }
                        }
                    } catch(e) {}
                }
                
                // Fallback si dimension32 falla: buscar los span
                if (priceText === 'No especificado') {
                    const priceSpan = article.querySelector('[data-testid="price"] .price');
                    const currencySpan = article.querySelector('[data-testid="price"] .currency');
                    if (priceSpan && currencySpan) {
                        priceText = currencySpan.innerText.trim() + ' $ ' + priceSpan.innerText.trim();
                    } else {
                        // Fallback antiguo
                        const priceRegex = /(US\$|ARS|\$)\s*[\d,.]+/i;
                        for (let i = lines.length - 1; i >= 0; i--) {
                            if (priceRegex.test(lines[i])) {
                                priceText = lines[i];
                                if (i > 0 && (lines[i-1].toLowerCase() === 'desde' || lines[i-1] === 'US$' || lines[i-1] === 'ARS' || lines[i-1] === '$')) {
                                   priceText = lines[i-1] + ' ' + priceText;
                                }
                                break;
                            } else if (lines[i].toLowerCase() === 'gratis') {
                                priceText = 'Gratis';
                                break;
                            }
                        }
                    }
                }
                
                // Duración
                const durationRegex = /\d+\s*(h|hs|horas|m|min|días|día)/i;
                const durationLine = lines.find(l => durationRegex.test(l));
                const duracion = durationLine || 'No especificada';
                
                // Descripción (líneas largas)
                const descLines = lines.slice(titleIdx + 1).filter(l => l.length > 40 && !durationRegex.test(l) && !l.toLowerCase().includes('cancelación'));
                const descripcion = descLines.length > 0 
                    ? descLines[0].substring(0, 200) + (descLines[0].length > 200 ? '...' : '')
                    : 'Sin descripción';
                    
                results.push({
                    origen: 'Civitatis',
                    titulo: title,
                    duracionEstimada: duracion,
                    franjaHoraria: 'No especificada',
                    precioPorPersona: priceText,
                    descripcionBreve: descripcion
                });
            });
            return { success: results.length > 0, data: results };
        });
        
        return extraction;
        
    } catch (e) {
        logFunction(`[Civitatis] Error: ${e.message}`);
        return { success: false, data: [] };
    }
}

// --- MODO CONSOLA INTERACTIVA ---
async function runInteractiveConsole() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n--- MODO CONSOLA: Scraper de Actividades Turísticas (Turismocity) ---');
    
    let browser;
    try {
        console.log('\n[Scraper] Iniciando navegador...');
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: BRAVE_PATH,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (['image', 'font', 'media'].includes(type)) req.abort();
            else req.continue();
        });

        // Navegar a Turismocity para establecer sesión (necesario para las APIs)
        await page.goto('https://www.turismocity.com.ar/', { waitUntil: 'domcontentloaded' });
        console.log('[Scraper] Navegador listo.\n');
        
        // Bucle de selección de destino
        let destinoElegido = null;

        while (!destinoElegido) {
            const inputDestino = await askQuestion('Ingresa el nombre del destino (ej. Roma, Cordoba, Viena, Paris) o "salir": ');
            
            if (inputDestino.trim().toLowerCase() === 'salir') {
                console.log('Cancelado por el usuario.');
                rl.close();
                return;
            }

            if (inputDestino.trim().length < 2) {
                console.log('Ingresa al menos 2 caracteres para buscar.');
                continue;
            }

            console.log('Buscando destinos...');
            const sugerencias = await fetchSugerenciasDestino(page, inputDestino.trim());
            
            if (sugerencias.length === 0) {
                console.log('No se encontraron destinos para esa búsqueda. Probá con otro nombre (ej. "roma", "paris", "mendoza").');
                continue;
            }

            console.log('\nDestinos encontrados:');
            sugerencias.forEach((dest, index) => {
                console.log(` ${index + 1}. ${dest.displayName}`);
            });

            const seleccion = await askQuestion('\nSelecciona un destino (número) o 0 para buscar de nuevo: ');
            
            if (seleccion.trim() === '0') continue;

            const idx = parseInt(seleccion) - 1;
            if (isNaN(idx) || idx < 0 || idx >= sugerencias.length) {
                console.log('Selección inválida. Intenta nuevamente.');
                continue;
            }

            destinoElegido = sugerencias[idx];
        }

        // Scrapear las actividades del destino elegido
        console.log(`\nBuscando actividades en ${destinoElegido.displayName}...`);
        
        const resultTC = await performScrape(page, destinoElegido.slug, console.log);
        
        // --- Agregamos scraping de Civitatis para obtener más resultados ---
        const resultCivi = await performCivitatisScrape(page, destinoElegido.cityName, destinoElegido.countryName, console.log);
        
        const combinedActivities = [];
        
        if (!resultTC.error && resultTC.activities) {
            combinedActivities.push(...resultTC.activities);
        }
        
        if (resultCivi.success && resultCivi.data) {
            combinedActivities.push(...resultCivi.data.slice(0, 15));
        }

        rl.close();
        
        if (combinedActivities.length === 0) {
            console.log(`\n[ERROR] No se encontraron actividades en ninguna de las fuentes.`);
            return;
        }

        console.log(`\n======================================================`);
        console.log(` RESULTADOS: ${combinedActivities.length} actividades encontradas en ${destinoElegido.displayName}`);
        console.log(`======================================================`);

        combinedActivities.forEach((act, idx) => {
            console.log(`\n--- ACTIVIDAD ${idx + 1} [${act.origen}] ---`);
            console.log(`  Título:       ${act.titulo}`);
            console.log(`  Duración:     ${act.duracionEstimada}`);
            console.log(`  Franja:       ${act.franjaHoraria}`);
            console.log(`  Precio p/p:   ${act.precioPorPersona}`);
            console.log(`  Descripción:  ${act.descripcionBreve}`);
        });

    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
    } finally {
        rl.close();
        if (browser) await browser.close();
    }
}

// --- MODO SERVIDOR API ---
function runApiServer() {
    const app = express();
    const PORT = 3001;
    app.use(express.json());

    app.get('/api/actividades', async (req, res) => {
        const { destinationSlug, minPrice, maxPrice } = req.query;
        if (!destinationSlug) {
            return res.status(400).json({ error: "Faltan parámetros: destinationSlug (ej. Cordoba_Argentina)" });
        }
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: BRAVE_PATH,
                defaultViewport: null,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const type = req.resourceType();
                if (['image', 'font', 'media'].includes(type)) req.abort();
                else req.continue();
            });

            console.log(`\n[API] Petición recibida para: ${destinationSlug}`);
            // En API mode, parseamos el slug para obtener ciudad y pais si es posible (ej: Cordoba_Argentina)
            const parts = destinationSlug.split('_');
            const cityName = parts[0] || destinationSlug;
            const countryName = parts[1] || '';
            
            const resultTC = await performScrape(page, destinationSlug, (msg) => console.log(msg));
            const resultCivi = await performCivitatisScrape(page, cityName, countryName, (msg) => console.log(msg));

            const combinedActivities = [];
            if (!resultTC.error && resultTC.activities) {
                combinedActivities.push(...resultTC.activities);
            }
            if (resultCivi.success && resultCivi.data) {
                combinedActivities.push(...resultCivi.data.slice(0, 15));
            }

            // Aplicar filtro de precio si se proveen minPrice o maxPrice
            let filteredActivities = combinedActivities;
            if (minPrice !== undefined || maxPrice !== undefined) {
                const min = minPrice ? parseInt(minPrice, 10) : 0;
                const max = maxPrice ? parseInt(maxPrice, 10) : Infinity;

                filteredActivities = combinedActivities.filter(act => {
                    const priceText = act.precioPorPersona || '';
                    if (priceText.toLowerCase().includes('gratis')) {
                        return min <= 0 && 0 <= max;
                    }
                    const numStr = priceText.replace(/[^\d]/g, '');
                    if (!numStr) return false; // Excluir si no hay precio y se requiere filtro
                    
                    const price = parseInt(numStr, 10);
                    return price >= min && price <= max;
                });
            }

            if (filteredActivities.length === 0) {
                return res.status(404).json({ error: "No se encontraron actividades" });
            }
            res.json({ 
                status: "success", 
                destination: destinationSlug,
                resultsFound: filteredActivities.length,
                activities: filteredActivities 
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        } finally {
            if (browser) await browser.close();
        }
    });

    app.listen(PORT, () => {
        console.log(`Servidor API iniciado en http://localhost:${PORT}`);
        console.log(`Ejemplo 1: http://localhost:${PORT}/api/actividades?destinationSlug=Cordoba_Argentina`);
        console.log(`Ejemplo 2: http://localhost:${PORT}/api/actividades?destinationSlug=Cordoba_Argentina&minPrice=20000&maxPrice=50000`);
    });
}

// --- MENÚ PRINCIPAL ---
import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const rlMain = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n=============================================');
    console.log(' SELECCIONA EL MODO DE EJECUCIÓN DEL SCRAPER');
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
}
