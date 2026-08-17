import express from 'express';
import cors from 'cors';
import * as readline from 'readline';
import fs from 'fs';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import cliProgress from 'cli-progress';
import { fileURLToPath } from 'url';

// Importar los Scrapers
import { performScrape as scrapeVuelos } from '../ScrapperVuelo/index.js';
import { performScrape as scrapeHoteles } from '../ScrapperHotel/booking.js';
import { performScrape as scrapeActividadesTC, performCivitatisScrape, fetchSugerenciasDestino } from '../ScrapperActividades/index.js';

// Importar Kiwi API
import { getIataAndEnglishName } from './kiwiApi.js';

puppeteer.use(StealthPlugin());
const BRAVE_PATH = '/opt/brave.com/brave-origin/brave';

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

// Variables globales para el servidor API
let globalBrowser = null;
let globalPage = null;

async function initBrowser() {
    if (!globalBrowser) {
        globalBrowser = await puppeteer.launch({
            headless: 'new',
            executablePath: BRAVE_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        globalPage = await globalBrowser.newPage();
        await globalPage.goto('https://www.turismocity.com.ar/', { waitUntil: 'domcontentloaded' });
    }
}

// -------------------------------------------------------------
// CORE ORCHESTRATION FUNCTION (Used by API and CLI)
// -------------------------------------------------------------
async function runOrchestration(params, page) {
    const { originName, destinationName, destinationSlug, departDate, returnDateStr, passengers, globalBudget } = params;
    
    // 1. Kiwi API
    const origenInfo = await getIataAndEnglishName(originName);
    const destinoInfo = await getIataAndEnglishName(destinationName);

    // 2. Vuelos
    const vuelosResult = await scrapeVuelos(origenInfo.iata, destinoInfo.iata, departDate, returnDateStr, passengers, () => {});

    // 3. Hoteles
    const hotelesResult = await scrapeHoteles(destinoInfo.englishName, departDate, returnDateStr || '', passengers, () => {});

    // 4. Actividades
    const actResultTC = await scrapeActividadesTC(page, destinationSlug, () => {});
    const slugParts = destinationSlug.split('_');
    const civiCity = slugParts[0] || destinationName;
    const civiCountry = slugParts.length > 1 ? slugParts[slugParts.length - 1] : 'Argentina';
    const actResultCivi = await performCivitatisScrape(page, civiCity, civiCountry, () => {});
    
    let allActivities = [];
    if (!actResultTC.error && actResultTC.activities) allActivities.push(...actResultTC.activities);
    if (actResultCivi.success && actResultCivi.data) allActivities.push(...actResultCivi.data);

    // 5. Filtro
    let vuelosFiltrados = [];
    if (!vuelosResult.error && vuelosResult.flights) {
        vuelosFiltrados = vuelosResult.flights.filter(v => parsePrice(v.price) <= globalBudget);
    }

    let hotelesFiltrados = [];
    if (!hotelesResult.error && hotelesResult.hotels) {
        hotelesFiltrados = hotelesResult.hotels.filter(h => {
            const p = parsePrice(h.price);
            return (p / passengers) <= globalBudget;
        });
    }

    let actividadesFiltradas = allActivities.filter(a => parsePrice(a.precioPorPersona) <= globalBudget);

    return {
        metadata: {
            origen: {
                input: originName,
                iata: origenInfo.iata,
                nombreIngles: origenInfo.englishName
            },
            destino: {
                input: destinationName,
                oficial: destinationName,
                slug: destinationSlug,
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
}


// -------------------------------------------------------------
// MODO SERVIDOR API REST
// -------------------------------------------------------------
function startApiServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Inicializar navegador al arrancar el servidor
    initBrowser().then(() => console.log('Motor de búsqueda iniciado y listo.')).catch(console.error);

    app.get('/api/sugerencias', async (req, res) => {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: "Parámetro 'q' requerido" });
        
        try {
            if (!globalPage) await initBrowser();
            const sugerencias = await fetchSugerenciasDestino(globalPage, query);
            res.json(sugerencias);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/viaje', async (req, res) => {
        const { originName, destinationName, destinationSlug, departDate, returnDateStr, passengers, budget } = req.body;
        
        if (!originName || !destinationName || !destinationSlug || !departDate || !budget) {
            return res.status(400).json({ error: "Faltan parámetros requeridos" });
        }

        try {
            if (!globalPage) await initBrowser();
            const params = {
                originName,
                destinationName,
                destinationSlug,
                departDate,
                returnDateStr: returnDateStr || '',
                passengers: parseInt(passengers) || 1,
                globalBudget: parseInt(String(budget).replace(/[^\d]/g, '')) || Infinity
            };
            
            const result = await runOrchestration(params, globalPage);
            
            fs.writeFileSync('resultados_finales.json', JSON.stringify(result, null, 4));
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    });

    const PORT = 4000;
    app.listen(PORT, () => {
        console.log(`\nServidor API REST de FREEVAGO corriendo en http://localhost:${PORT}`);
        console.log(`Endpoints disponibles:`);
        console.log(`- GET /api/sugerencias?q=cordoba`);
        console.log(`- POST /api/viaje`);
    });
}

// -------------------------------------------------------------
// MODO CONSOLA INTERACTIVO
// -------------------------------------------------------------
async function startConsoleMode() {
    let progressBar;
    try {
        console.log('\n[Iniciando motor de búsqueda para autocompletado, aguarde unos segundos...]');
        await initBrowser();

        // -- ORIGEN --
        const originInput = await askQuestion('\nOrigen (Búsqueda inicial, ej. "Buenos Aires"): ');
        const sugOrigen = await fetchSugerenciasDestino(globalPage, originInput);
        if (!sugOrigen || sugOrigen.length === 0) {
            throw new Error(`No se encontraron orígenes coincidentes para "${originInput}"`);
        }
        
        console.log(`\nSugerencias encontradas para origen "${originInput}":`);
        sugOrigen.forEach((sug, idx) => {
            console.log(` ${idx + 1}. ${sug.displayName}`);
        });

        const selectedIdxOriStr = await askQuestion('Selecciona el número de tu origen: ');
        let selectedIdxOri = parseInt(selectedIdxOriStr) - 1;
        if (isNaN(selectedIdxOri) || selectedIdxOri < 0 || selectedIdxOri >= sugOrigen.length) selectedIdxOri = 0;
        const tcOriginName = sugOrigen[selectedIdxOri].cityName || sugOrigen[selectedIdxOri].displayName;


        // -- DESTINO --
        let destQuery = await askQuestion('\nDestino (Búsqueda inicial, ej. "Cordoba"): ');
        const sugerencias = await fetchSugerenciasDestino(globalPage, destQuery);
        if (!sugerencias || sugerencias.length === 0) {
            throw new Error(`No se encontraron destinos coincidentes para "${destQuery}"`);
        }
        
        console.log(`\nSugerencias encontradas para destino "${destQuery}":`);
        sugerencias.forEach((sug, idx) => {
            console.log(` ${idx + 1}. ${sug.displayName}`);
        });

        const selectedIdxStr = await askQuestion('Selecciona el número de tu destino: ');
        let selectedIdx = parseInt(selectedIdxStr) - 1;
        if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= sugerencias.length) selectedIdx = 0;
        const tcLocationName = sugerencias[selectedIdx].cityName || sugerencias[selectedIdx].displayName; 
        const tcDestinationSlug = sugerencias[selectedIdx].slug; 

        // -- RESTO DE DATOS --
        const departDate = await askQuestion('\nFecha de Ida (ej. 2026-10-10): ');
        const returnDateStr = await askQuestion('Fecha de Vuelta (Opcional, enter para ONEWAY): ');
        const passengersStr = await askQuestion('Cantidad de personas (ej. 1): ');
        const budgetStr = await askQuestion('Presupuesto máximo por persona (ej. 500000): ');

        rl.close();

        const params = {
            originName: tcOriginName,
            destinationName: tcLocationName,
            destinationSlug: tcDestinationSlug,
            departDate,
            returnDateStr,
            passengers: parseInt(passengersStr) || 1,
            globalBudget: parseInt(budgetStr.replace(/[^\d]/g, '')) || Infinity
        };

        progressBar = new cliProgress.SingleBar({
            format: 'Progreso |{bar}| {percentage}% || Procesando Scrapers...',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
        progressBar.start(100, 10);

        const progressInterval = setInterval(() => {
            if (progressBar.value < 90) progressBar.increment(5);
        }, 3000);

        const result = await runOrchestration(params, globalPage);
        
        clearInterval(progressInterval);
        progressBar.update(100);
        progressBar.stop();
        
        fs.writeFileSync('resultados_finales.json', JSON.stringify(result, null, 4));

        console.log('\n\n========================================================');
        console.log(' PROCESO COMPLETADO CON ÉXITO');
        console.log('========================================================');
        console.log(`- Vuelos viables encontrados: ${result.resultados.vuelos.dentroDelPresupuesto}`);
        console.log(`- Hoteles viables encontrados: ${result.resultados.hoteles.dentroDelPresupuesto}`);
        console.log(`- Actividades viables encontradas: ${result.resultados.actividades.dentroDelPresupuesto}`);
        console.log(`\nTodos los detalles se han guardado en 'resultados_finales.json'`);
        
    } catch (error) {
        if (progressBar) progressBar.stop();
        console.error(`\n[ERROR CRÍTICO] Hubo un fallo en la orquestación: ${error.message}`);
        console.error(error.stack);
    } finally {
        if (globalBrowser) await globalBrowser.close();
        process.exit(0);
    }
}

// -------------------------------------------------------------
// MENÚ DE ARRANQUE
// -------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log('\n========================================================');
    console.log('   FREEVAGO - ORQUESTADOR DE VIAJES (INTEGRACIÓN TOTAL)');
    console.log('========================================================');
    console.log(' 1. Modo Consola (Interactivo)');
    console.log(' 2. Servidor API REST');
    
    rl.question('\nIngresa 1 o 2: ', (answer) => {
        if (answer.trim() === '1') {
            startConsoleMode();
        } else if (answer.trim() === '2') {
            rl.close();
            startApiServer();
        } else {
            console.log('Opción inválida. Saliendo...');
            rl.close();
            process.exit(0);
        }
    });
}
