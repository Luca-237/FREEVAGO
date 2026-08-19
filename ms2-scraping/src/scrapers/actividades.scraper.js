import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const BRAVE_PATH = process.env.BRAVE_PATH || '/opt/brave.com/brave-origin/brave';

async function launchPage() {
    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: BRAVE_PATH,
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

    return { browser, page };
}

function quitarTildes(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Autocompletado de destino: resuelve un texto libre ("cordoba") a una lista
// de {displayName, slug, cityName, countryName, iata}, validada contra el
// GraphQL de Turismocity. Necesita una page que ya haya navegado a
// turismocity.com.ar (para tener sesión activa).
async function fetchSugerenciasDestino(page, query) {
    const results = await page.evaluate(async (q) => {
        try {
            const res = await fetch('https://api.turismocity.com/flights/fullLocation/AR?&departure=NONE&query=' + encodeURIComponent(q));
            const data = await res.json();

            // Ciudades únicas, prefiriendo el tipo 'City' sobre 'Airport' cuando
            // aparecen ambos para la misma ciudad (trae el código de ciudad,
            // no el de un aeropuerto puntual).
            const citiesMap = new Map();
            for (const item of data) {
                if (!item.city || !item.country) continue;
                const key = item.city + '_' + item.country;
                const existing = citiesMap.get(key);
                if (!existing || (item.type === 'City' && existing.type !== 'City')) {
                    citiesMap.set(key, { city: item.city, country: item.country, iata: item.iata, type: item.type });
                }
            }

            const validated = [];
            for (const [, { city, country, iata }] of citiesMap) {
                const slugCity = city.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
                const slugCountry = country.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
                const slug = slugCity + '_' + slugCountry;

                try {
                    const gqlQuery = 'query($slug: String!, $iso: String!) { city(slug: $slug, iso: $iso) { id name slug searchname country { name } } }';
                    const gqlUrl = 'https://api.turismocity.com/graphql-cdn?query=' + encodeURIComponent(gqlQuery) + '&variables=' + encodeURIComponent(JSON.stringify({ iso: 'AR', slug }));
                    const gqlRes = await fetch(gqlUrl);
                    const gqlData = await gqlRes.json();

                    if (gqlData.data && gqlData.data.city) {
                        const c = gqlData.data.city;
                        validated.push({
                            displayName: c.searchname || (c.name + ', ' + c.country.name),
                            slug: c.slug,
                            cityName: c.name,
                            countryName: c.country.name,
                            iata: iata || null
                        });
                    }
                } catch (e) {
                    // si falla la validación de esta ciudad puntual, se omite y se sigue
                }
            }

            return validated;
        } catch (e) {
            return [];
        }
    }, query);

    return results;
}

// Scraping de actividades en Turismocity para un slug ya resuelto (ej. "Cordoba_Argentina")
async function scrapeTurismocity(page, destinationSlug, logFunction) {
    const searchUrl = `https://www.turismocity.com.ar/actividades-en-${destinationSlug}`;
    logFunction(`[Turismocity] Navegando a: ${searchUrl}`);

    try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (navError) {
        return { success: false, data: [] };
    }

    logFunction('[Turismocity] Esperando carga de actividades...');
    await new Promise(r => setTimeout(r, 15000));

    return page.evaluate(() => {
        const results = [];
        const cards = Array.from(document.querySelectorAll('.tc-activities-card'));
        const seen = new Set();

        cards.forEach(card => {
            const text = card.innerText || '';
            if (text.length < 20) return;

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

            const durationRegex = /\d+\s*(hs|h\s|h$|m\s|m$|min)/i;
            const durationLine = lines.find(l => durationRegex.test(l));
            const duracion = durationLine || 'No especificada';

            let franjaHoraria = 'No especificada';
            const franjaRegex = /\d{1,2}:\d{2}\s*(hs|am|pm)/i;
            const franjaLine = lines.find(l => franjaRegex.test(l));
            if (franjaLine) franjaHoraria = franjaLine;

            const descLines = lines.slice(1).filter(l => l.length > 30 && !durationRegex.test(l) && !franjaRegex.test(l));
            const descripcion = descLines.length > 0
                ? descLines.join(' ').substring(0, 200) + (descLines.join(' ').length > 200 ? '...' : '')
                : 'Sin descripción disponible';

            results.push({
                origen: 'Turismocity',
                titulo: title,
                duracionEstimada: duracion,
                franjaHoraria,
                precioPorPersona: priceText,
                descripcionBreve: descripcion
            });
        });

        return { success: results.length > 0, data: results };
    });
}

// Scraping de actividades en Civitatis para una ciudad/país ya resueltos
async function scrapeCivitatis(page, cityName, countryName, logFunction) {
    const normalize = (str) => quitarTildes(str).toLowerCase().replace(/\s+/g, '-');
    const citySlug = normalize(cityName);
    const countrySlug = normalize(countryName || '');

    try {
        await page.setCookie({ name: 'currency', value: 'ARS', domain: '.civitatis.com' });
    } catch (e) {
        // no crítico si falla, sigue con la moneda default del sitio
    }

    let url = `https://www.civitatis.com/ar/${citySlug}-${countrySlug}/?currency=ARS`;
    logFunction(`[Civitatis] Probando URL: ${url}`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        let currentUrl = page.url();
        const esHome = (u) => u.split('?')[0] === 'https://www.civitatis.com/ar/' || u.split('?')[0] === 'https://www.civitatis.com/ar';

        if (esHome(currentUrl)) {
            url = `https://www.civitatis.com/ar/${citySlug}/?currency=ARS`;
            logFunction(`[Civitatis] Redirección detectada. Probando URL corta: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            currentUrl = page.url();

            if (esHome(currentUrl)) {
                const words = citySlug.split('-');
                if (words.length > 1) {
                    url = `https://www.civitatis.com/ar/${words[words.length - 1]}/?currency=ARS`;
                    logFunction(`[Civitatis] Probando última palabra: ${url}`);
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    currentUrl = page.url();
                }

                if (esHome(currentUrl)) {
                    logFunction('[Civitatis] No se encontró la página para este destino.');
                    return { success: false, data: [] };
                }
            }
        }

        logFunction('[Civitatis] Página encontrada. Extrayendo actividades...');
        await new Promise(r => setTimeout(r, 5000));

        return page.evaluate(() => {
            const results = [];
            const articles = Array.from(document.querySelectorAll('article'));
            const seen = new Set();

            articles.forEach(article => {
                const text = article.innerText || '';
                if (text.length < 30) return;

                const lines = text.split('\n').map(l => l.trim()).filter(l => l);

                let titleIdx = 0;
                while (titleIdx < lines.length && (lines[titleIdx].toLowerCase() === 'like' || lines[titleIdx] === '10' || lines[titleIdx].includes('TOP') || lines[titleIdx] === '')) {
                    titleIdx++;
                }
                const title = lines[titleIdx] || 'Sin título';

                if (seen.has(title)) return;
                seen.add(title);

                let priceText = 'No especificado';

                const linkElement = article.querySelector('a[data-gtm-new-model-click]');
                if (linkElement) {
                    try {
                        const gtmData = JSON.parse(linkElement.getAttribute('data-gtm-new-model-click'));
                        if (gtmData?.ecommerce?.click?.products?.length > 0) {
                            const product = gtmData.ecommerce.click.products[0];
                            if (product.dimension32 !== undefined) {
                                priceText = 'ARS $ ' + product.dimension32.toLocaleString('es-AR');
                            }
                        }
                    } catch (e) {
                        // fallback abajo
                    }
                }

                if (priceText === 'No especificado') {
                    const priceSpan = article.querySelector('[data-testid="price"] .price');
                    const currencySpan = article.querySelector('[data-testid="price"] .currency');
                    if (priceSpan && currencySpan) {
                        priceText = currencySpan.innerText.trim() + ' $ ' + priceSpan.innerText.trim();
                    } else {
                        const priceRegex = /(US\$|ARS|\$)\s*[\d,.]+/i;
                        for (let i = lines.length - 1; i >= 0; i--) {
                            if (priceRegex.test(lines[i])) {
                                priceText = lines[i];
                                if (i > 0 && (lines[i - 1].toLowerCase() === 'desde' || lines[i - 1] === 'US$' || lines[i - 1] === 'ARS' || lines[i - 1] === '$')) {
                                    priceText = lines[i - 1] + ' ' + priceText;
                                }
                                break;
                            } else if (lines[i].toLowerCase() === 'gratis') {
                                priceText = 'Gratis';
                                break;
                            }
                        }
                    }
                }

                const durationRegex = /\d+\s*(h|hs|horas|m|min|días|día)/i;
                const durationLine = lines.find(l => durationRegex.test(l));
                const duracion = durationLine || 'No especificada';

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
    } catch (e) {
        logFunction(`[Civitatis] Error: ${e.message}`);
        return { success: false, data: [] };
    }
}

// FUNCIÓN NÚCLEO PÚBLICA — recibe un destino YA RESUELTO (slug de Turismocity
// + nombre de ciudad, tal cual los devuelve performSugerencias) y scrapea
// Turismocity + Civitatis. Mismo patrón que vuelos/hoteles: abre y cierra su
// propio navegador.
export async function performScrape(destinationSlug, destinationName, logFunction = console.log) {
    if (!destinationSlug || !destinationName) {
        return { error: 'Faltan parámetros: destinationSlug, destinationName' };
    }

    let browser;
    try {
        const launched = await launchPage();
        browser = launched.browser;
        const page = launched.page;

        const slugParts = destinationSlug.split('_');
        const countryName = slugParts.length > 1 ? slugParts.slice(1).join(' ') : '';

        const [resultTC, resultCivi] = await Promise.all([
            scrapeTurismocity(page, destinationSlug, logFunction),
            scrapeCivitatis(page, destinationName, countryName, logFunction)
        ]);

        const activities = [];
        if (resultTC.success && resultTC.data) activities.push(...resultTC.data);
        if (resultCivi.success && resultCivi.data) activities.push(...resultCivi.data.slice(0, 15));

        if (activities.length === 0) {
            return { error: `No se encontraron actividades para "${destinationName}" en ninguna fuente` };
        }

        return {
            destinationSlug,
            destinationName,
            resultsFound: activities.length,
            activities: activities.slice(0, 15)
        };
    } catch (error) {
        return { error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

// Autocompletado standalone: dado un texto libre, devuelve sugerencias de
// destino con slug + iata, para /api/sugerencias.
export async function performSugerencias(query, logFunction = console.log) {
    let browser;
    try {
        const launched = await launchPage();
        browser = launched.browser;
        const page = launched.page;

        await page.goto('https://www.turismocity.com.ar/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        logFunction(`[Sugerencias] Buscando: ${query}`);
        const sugerencias = await fetchSugerenciasDestino(page, query);
        return { sugerencias };
    } catch (error) {
        return { error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

// Uso interno (scrapingResult.service.js): a partir de un nombre de destino
// en texto libre, resuelve la mejor sugerencia y scrapea en la misma sesión
// de navegador (evita levantar dos navegadores para una sola búsqueda).
export async function performScrapeAuto(destino, logFunction = console.log) {
    let browser;
    try {
        const launched = await launchPage();
        browser = launched.browser;
        const page = launched.page;

        await page.goto('https://www.turismocity.com.ar/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        const sugerencias = await fetchSugerenciasDestino(page, destino);
        if (!sugerencias || sugerencias.length === 0) {
            return { error: `No se pudo resolver el destino "${destino}" (sin sugerencias)` };
        }
        const resuelto = sugerencias[0];

        const [resultTC, resultCivi] = await Promise.all([
            scrapeTurismocity(page, resuelto.slug, logFunction),
            scrapeCivitatis(page, resuelto.cityName, resuelto.countryName, logFunction)
        ]);

        const activities = [];
        if (resultTC.success && resultTC.data) activities.push(...resultTC.data);
        if (resultCivi.success && resultCivi.data) activities.push(...resultCivi.data.slice(0, 15));

        if (activities.length === 0) {
            return { error: `No se encontraron actividades para "${resuelto.displayName}" en ninguna fuente` };
        }

        return {
            destino,
            resuelto: resuelto.displayName,
            resultsFound: activities.length,
            activities: activities.slice(0, 15)
        };
    } catch (error) {
        return { error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}
