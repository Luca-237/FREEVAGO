import * as readline from 'readline';
import fs from 'fs';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import cliProgress from 'cli-progress';

// Importar los Scrapers
import { performScrape as scrapeVuelos } from '../ScrapperVuelo/index.js';
import { performScrape as scrapeHoteles } from '../ScrapperHotel/booking.js';
import { performScrape as scrapeActividadesTC, performCivitatisScrape, fetchSugerenciasDestino } from '../ScrapperActividades/index.js';

// Importar Kiwi API
import { getIataAndEnglishName } from './kiwiApi.js';

puppeteer.use(StealthPlugin());
const BRAVE_PATH = '/opt/brave.com/brave-origin/brave';

// Utilidad para extraer valor numérico de precios
function parsePrice(priceStr) {
    if (!priceStr || typeof priceStr !== 'string') return 0;
    const lower = priceStr.toLowerCase();
    if (lower.includes('gratis') || lower.includes('free')) return 0;
    
    const numStr = priceStr.replace(/[^\d]/g, '');
    if (!numStr) return 0;
    return parseInt(numStr, 10);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const askQuestion = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
    console.log('\n========================================================');
    console.log('   FREEVAGO - ORQUESTADOR DE VIAJES (INTEGRACIÓN TOTAL)');
    console.log('========================================================\n');

    // 1. Recolección de Inputs
    // No cerramos readline aún porque necesitamos preguntar la opción de destino luego

    let browser;
    let progressBar;
    try {
        console.log('\n[Iniciando motor de búsqueda para autocompletado, aguarde unos segundos...]');
        // Lanzamos el navegador que usará Actividades y Turismocity
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: BRAVE_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto('https://www.turismocity.com.ar/', { waitUntil: 'domcontentloaded' });

        // -- ORIGEN --
        const originInput = await askQuestion('\nOrigen (Búsqueda inicial, ej. "Buenos Aires"): ');
        const sugOrigen = await fetchSugerenciasDestino(page, originInput);
        if (!sugOrigen || sugOrigen.length === 0) {
            rl.close();
            throw new Error(`No se encontraron orígenes coincidentes para "${originInput}"`);
        }
        
        console.log(`\nSugerencias encontradas para origen "${originInput}":`);
        sugOrigen.forEach((sug, idx) => {
            console.log(` ${idx + 1}. ${sug.displayName}`);
        });

        const selectedIdxOriStr = await askQuestion('Selecciona el número de tu origen: ');
        let selectedIdxOri = parseInt(selectedIdxOriStr) - 1;
        if (isNaN(selectedIdxOri) || selectedIdxOri < 0 || selectedIdxOri >= sugOrigen.length) {
            selectedIdxOri = 0;
            console.log('Selección inválida. Seleccionando la opción 1 por defecto.');
        }
        const bestOri = sugOrigen[selectedIdxOri];
        const tcOriginName = bestOri.cityName || bestOri.displayName;


        // -- DESTINO --
        let destQuery = await askQuestion('\nDestino (Búsqueda inicial, ej. "Cordoba"): ');
        const sugerencias = await fetchSugerenciasDestino(page, destQuery);
        if (!sugerencias || sugerencias.length === 0) {
            rl.close();
            throw new Error(`No se encontraron destinos coincidentes para "${destQuery}"`);
        }
        
        console.log(`\nSugerencias encontradas para destino "${destQuery}":`);
        sugerencias.forEach((sug, idx) => {
            console.log(` ${idx + 1}. ${sug.displayName}`);
        });

        const selectedIdxStr = await askQuestion('Selecciona el número de tu destino: ');
        let selectedIdx = parseInt(selectedIdxStr) - 1;
        if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= sugerencias.length) {
            selectedIdx = 0;
            console.log('Selección inválida. Seleccionando la opción 1 por defecto.');
        }

        const bestDest = sugerencias[selectedIdx];
        const tcLocationName = bestDest.cityName || bestDest.displayName; 
        const tcDestinationSlug = bestDest.slug; 

        // -- RESTO DE DATOS --
        const departDate = await askQuestion('\nFecha de Ida (ej. 2026-10-10): ');
        const returnDateStr = await askQuestion('Fecha de Vuelta (Opcional, enter para ONEWAY): ');
        const passengersStr = await askQuestion('Cantidad de personas (ej. 1): ');
        const budgetStr = await askQuestion('Presupuesto máximo por persona (ej. 500000): ');

        const passengers = parseInt(passengersStr) || 1;
        const globalBudget = parseInt(budgetStr.replace(/[^\d]/g, '')) || Infinity;

        // Ya no necesitamos preguntar más
        rl.close();

        // Barra de progreso (6 etapas principales)
        progressBar = new cliProgress.SingleBar({
            format: 'Progreso |{bar}| {percentage}% || {value}/{total} Pasos || {etapa}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
        
        progressBar.start(6, 1, { etapa: 'Autocompletado completado.' });

        // ---------------------------------------------------------
        // PASO 2: API de Kiwi (Traducir e IATA)
        // ---------------------------------------------------------
        progressBar.update(2, { etapa: 'Traduciendo ubicaciones y buscando IATA (Kiwi API)...' });
        
        const origenInfo = await getIataAndEnglishName(tcOriginName);
        const destinoInfo = await getIataAndEnglishName(tcLocationName);

        // ---------------------------------------------------------
        // PASO 3: Scraper de Vuelos (Kayak)
        // ---------------------------------------------------------
        progressBar.update(3, { etapa: 'Buscando Vuelos...' });
        // No imprimimos logs de Vuelos para no ensuciar la barra de progreso
        const vuelosResult = await scrapeVuelos(origenInfo.iata, destinoInfo.iata, departDate, returnDateStr, passengers, () => {});

        // ---------------------------------------------------------
        // PASO 4: Scraper de Hoteles (Booking)
        // ---------------------------------------------------------
        progressBar.update(4, { etapa: 'Buscando Hoteles...' });
        // Usamos el nombre en inglés y las fechas
        const hotelesResult = await scrapeHoteles(destinoInfo.englishName, departDate, returnDateStr || '', passengers, () => {});

        // ---------------------------------------------------------
        // PASO 5: Scraper de Actividades (Turismocity + Civitatis)
        // ---------------------------------------------------------
        progressBar.update(5, { etapa: 'Buscando Actividades Turísticas...' });
        
        const actResultTC = await scrapeActividadesTC(page, tcDestinationSlug, () => {});
        // Extraemos ciudad y país para civitatis (ej. de "Cordoba_Argentina")
        const slugParts = tcDestinationSlug.split('_');
        const civiCity = slugParts[0] || tcLocationName;
        const civiCountry = slugParts.length > 1 ? slugParts[slugParts.length - 1] : 'Argentina';
        const actResultCivi = await performCivitatisScrape(page, civiCity, civiCountry, () => {});
        
        let allActivities = [];
        if (!actResultTC.error && actResultTC.activities) allActivities.push(...actResultTC.activities);
        if (actResultCivi.success && actResultCivi.data) allActivities.push(...actResultCivi.data);

        // ---------------------------------------------------------
        // PASO 6: Filtrado por Presupuesto y Generación de JSON
        // ---------------------------------------------------------
        progressBar.update(6, { etapa: 'Filtrando resultados y generando JSON...' });

        // Filtrado Individual: Descartamos cualquier elemento cuyo precio base por persona supere el presupuesto
        // VUELOS
        let vuelosFiltrados = [];
        if (!vuelosResult.error && vuelosResult.flights) {
            vuelosFiltrados = vuelosResult.flights.filter(v => parsePrice(v.price) <= globalBudget);
        }

        // HOTELES (booking price is usually total for the stay and adults, but user budget is per person. 
        // If we strictly filter `price <= globalBudget`, we do it here)
        let hotelesFiltrados = [];
        if (!hotelesResult.error && hotelesResult.hotels) {
            hotelesFiltrados = hotelesResult.hotels.filter(h => {
                const p = parsePrice(h.price);
                // Si el precio de booking es por el total, dividimos por pasajeros (aprox)
                // Usualmente Booking da precio total. Lo dividiremos para comparar con budget por persona.
                return (p / passengers) <= globalBudget;
            });
        }

        // ACTIVIDADES
        let actividadesFiltradas = allActivities.filter(a => parsePrice(a.precioPorPersona) <= globalBudget);

        const resultadosFinales = {
            metadata: {
                origen: {
                    input: tcOriginName,
                    iata: origenInfo.iata,
                    nombreIngles: origenInfo.englishName
                },
                destino: {
                    input: destQuery,
                    oficial: tcLocationName,
                    slug: tcDestinationSlug,
                    iata: destinoInfo.iata,
                    nombreIngles: destinoInfo.englishName
                },
                viaje: {
                    ida: departDate,
                    vuelta: returnDateStr || null,
                    pasajeros: passengers,
                    presupuestoPorPersona: globalBudget
                }
            },
            resultados: {
                vuelos: {
                    totalEncontrados: vuelosResult.flights ? vuelosResult.flights.length : 0,
                    dentroDelPresupuesto: vuelosFiltrados.length,
                    opciones: vuelosFiltrados
                },
                hoteles: {
                    totalEncontrados: hotelesResult.hotels ? hotelesResult.hotels.length : 0,
                    dentroDelPresupuesto: hotelesFiltrados.length,
                    opciones: hotelesFiltrados
                },
                actividades: {
                    totalEncontrados: allActivities.length,
                    dentroDelPresupuesto: actividadesFiltradas.length,
                    opciones: actividadesFiltradas
                }
            }
        };

        fs.writeFileSync('resultados_finales.json', JSON.stringify(resultadosFinales, null, 4));
        
        progressBar.stop();
        console.log('\n\n========================================================');
        console.log(' PROCESO COMPLETADO CON ÉXITO');
        console.log('========================================================');
        console.log(`- Vuelos viables encontrados: ${vuelosFiltrados.length}`);
        console.log(`- Hoteles viables encontrados: ${hotelesFiltrados.length}`);
        console.log(`- Actividades viables encontradas: ${actividadesFiltradas.length}`);
        console.log(`\nTodos los detalles se han guardado en 'resultados_finales.json'`);
        
    } catch (error) {
        if (progressBar) progressBar.stop();
        console.error(`\n[ERROR CRÍTICO] Hubo un fallo en la orquestación: ${error.message}`);
        console.error(error.stack);
    } finally {
        if (browser) await browser.close();
    }
}

main();
