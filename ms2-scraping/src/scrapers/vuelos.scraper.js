import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { resolveBrowserPath } from '../utils/browserPath.util.js';

puppeteer.use(StealthPlugin());

// Función auxiliar para sumar o restar días
function addDaysToDateString(dateStr, days) {
    if (!dateStr || !dateStr.trim()) return dateStr;
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

// Transformar el crudo a JSON
function parseFlightData(flightStr) {
    const segments = flightStr.split('|').map(s => s.trim());
    const price = segments.find(s => s.includes('$') || s.includes('ARS') || s.includes('USD') || s.includes('€')) || 'Precio no encontrado';
    const timeRegex = /\d{1,2}:\d{2}\s*[a|p]m?.*?\d{1,2}:\d{2}\s*[a|p]m?/i;
    let legs = [];

    for (let i = 0; i < segments.length; i++) {
        if (timeRegex.test(segments[i])) {
            let legInfo = {
                time: segments[i],
                airline: segments[i + 1] && !segments[i + 1].match(/^\d/) ? segments[i + 1] : 'Desconocida',
                stops: segments[i + 2] && segments[i + 2].includes('stop') ? segments[i + 2] : (segments[i + 1] && segments[i + 1].includes('stop') ? segments[i + 1] : 'Directo'),
                layover: '',
                duration: '',
                route: ''
            };
            for (let j = 1; j <= 7; j++) {
                if (!segments[i + j]) continue;
                if (segments[i + j].toLowerCase().includes('layover')) legInfo.layover = segments[i + j];
                if (/^\d+h\s*\d*m?$/.test(segments[i + j])) legInfo.duration = segments[i + j];
                if (segments[i + j] === '-') legInfo.route = `${segments[i + j - 1]}-${segments[i + j + 1]}`;
            }
            legs.push(legInfo);
        }
    }
    return { price, legs, rawText: flightStr };
}

// FUNCIÓN NÚCLEO (Usada tanto por la API como por la consola)
async function performScrape(originInput, destination, departDate, returnDateStr, passengers, logFunction = console.log) {
    const origins = originInput.split(',').map(o => o.trim().toUpperCase());

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: resolveBrowserPath(),
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (['image', 'font', 'stylesheet', 'media'].includes(type)) req.abort();
            else req.continue();
        });

        let vuelosEncontrados = false;
        let extraction = { success: false, data: [] };
        let finalOrigin = '';
        let finalDepartDate = '';

        for (const currentOrigin of origins) {
            if (vuelosEncontrados) break;

            const MAX_INTENTOS = 5;
            let intentos = 0;
            let currentDepart = departDate;
            let currentReturn = returnDateStr;

            while (intentos < MAX_INTENTOS) {
                const tripType = currentReturn.trim() ? 'ROUNDTRIP' : 'ONEWAY';
                let searchUrl = `https://booking.kayak.com/flights/${currentOrigin}-${destination.toUpperCase()}/${currentDepart}`;
                if (currentReturn.trim()) searchUrl += `/${currentReturn}`;
                searchUrl += `?adults=${passengers}&cabin_class=ECONOMY&sort=bestflight_a`;

                logFunction(`\n[Scraper] Navegando a: ${searchUrl}`);

                try {
                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                } catch (navError) {
                    logFunction(`[Scraper] Falló navegación: ${navError.message}`);
                    break;
                }

                logFunction(`[Scraper] Esperando carga de vuelos...`);
                await new Promise(r => setTimeout(r, 15000));

                if (page.url().includes('not-available')) {
                    logFunction(`[Scraper] Sin vuelos el ${currentDepart} desde ${currentOrigin}. Probando +1 día...`);
                    currentDepart = addDaysToDateString(currentDepart, 1);
                    if (currentReturn.trim()) currentReturn = addDaysToDateString(currentReturn, 1);
                    intentos++;
                } else {
                    logFunction(`[Scraper] Página cargada para Ida: ${currentDepart} / Vuelta: ${currentReturn || 'N/A'} desde ${currentOrigin}`);

                    extraction = await page.evaluate(() => {
                        const selectors = [
                            'div[data-testid="searchresults-card"]', 'div[data-testid^="flight_card"]',
                            'div.FlightCard', 'div[data-resultid]', 'div.inner-grid', 'div.resultWrapper',
                            'div.Base-Results-HorizontalResultCard', 'div[class*="ResultCard"]',
                            'li[role="listitem"]', '.nrc6-inner', 'div.js-flight-list > div, ul.flight-list > li'
                        ];
                        let cards = [];
                        for (const selector of selectors) {
                            const found = document.querySelectorAll(selector);
                            if (found.length > 0) {
                                const validCards = Array.from(found).filter(c => c.innerText && c.innerText.length > 20);
                                if (validCards.length > 0) { cards = validCards; break; }
                            }
                        }
                        if (cards.length === 0) {
                            const allDivs = document.querySelectorAll('div');
                            const priceRegex = /[$€£]\s?\d+([.,]\d+)?|ARS\s?\d+/;
                            const timeRegex = /\d{1,2}:\d{2}.*[ap]?m?/i;
                            cards = Array.from(allDivs).filter(div => {
                                const t = div.innerText || '';
                                return t.length > 50 && t.length < 500 && priceRegex.test(t) && timeRegex.test(t);
                            });
                        }
                        if (cards.length === 0) return { success: false, data: [] };

                        const results = [];
                        const seen = new Set();
                        cards.forEach(card => {
                            const rt = card.innerText || '';
                            if (rt && (rt.includes('$') || rt.includes('ARS') || rt.includes('USD') || rt.includes('€'))) {
                                const cleanInfo = rt.split('\n').map(l => l.trim()).filter(l => l).join(' | ');
                                if (!seen.has(cleanInfo)) { seen.add(cleanInfo); results.push(cleanInfo); }
                            }
                        });
                        return { success: true, data: results };
                    });

                    if (extraction.success && extraction.data.length > 0) {
                        vuelosEncontrados = true;
                        finalOrigin = currentOrigin;
                        finalDepartDate = currentDepart;
                    }
                    break;
                }
            }
        }

        if (!vuelosEncontrados || !extraction.success || extraction.data.length === 0) {
            return { error: 'No se encontraron vuelos tras agotar la búsqueda aproximada.' };
        }

        const parsedFlights = extraction.data.slice(0, 10).map(f => parseFlightData(f));
        return {
            origin: finalOrigin,
            destination: destination.toUpperCase(),
            departDate: finalDepartDate,
            resultsFound: parsedFlights.length,
            flights: parsedFlights
        };

    } catch (error) {
        return { error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

export { performScrape, parseFlightData, addDaysToDateString };
