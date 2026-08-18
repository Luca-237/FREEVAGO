import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Importar los Scrapers individuales
import { performScrape as scrapeVuelos } from './ScrapperVuelo/index.js';
import { performScrape as scrapeHoteles } from './ScrapperHotel/booking.js';
import { performScrape as scrapeActividadesTC, performCivitatisScrape, fetchSugerenciasDestino } from './ScrapperActividades/index.js';

puppeteer.use(StealthPlugin());
const BRAVE_PATH = '/opt/brave.com/brave-origin/brave';

const app = express();
app.use(cors());
app.use(express.json());

// Variables globales para el navegador
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

// Inicializar el navegador al arrancar
initBrowser().then(() => console.log('✅ Motor de búsqueda Puppeteer inicializado.')).catch(console.error);

// Helper de parseo de precios
function parsePrice(priceStr) {
    if (!priceStr || typeof priceStr !== 'string') return 0;
    const lower = priceStr.toLowerCase();
    if (lower.includes('gratis') || lower.includes('free')) return 0;
    const numStr = priceStr.replace(/[^\d]/g, '');
    if (!numStr) return 0;
    return parseInt(numStr, 10);
}

// Lógica de orquestación
async function runOrchestration(params, page) {
    const { originName, destinationName, destinationSlug, departDate, returnDateStr, passengers, globalBudget, originIata, destinationIata } = params;
    
    const origenInfo = { iata: originIata, englishName: originName };
    const destinoInfo = { iata: destinationIata, englishName: destinationName };

    const vuelosResult = await scrapeVuelos(origenInfo.iata, destinoInfo.iata, departDate, returnDateStr, passengers, () => {});
    const hotelesResult = await scrapeHoteles(destinoInfo.englishName, departDate, returnDateStr || '', passengers, () => {});
    
    const actResultTC = await scrapeActividadesTC(page, destinationSlug, () => {});
    const slugParts = destinationSlug.split('_');
    const civiCity = slugParts[0] || destinationName;
    const civiCountry = slugParts.length > 1 ? slugParts[slugParts.length - 1] : 'Argentina';
    const actResultCivi = await performCivitatisScrape(page, civiCity, civiCountry, () => {});
    
    let allActivities = [];
    if (!actResultTC.error && actResultTC.activities) allActivities.push(...actResultTC.activities);
    if (actResultCivi.success && actResultCivi.data) allActivities.push(...actResultCivi.data);

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
            origen: { input: originName, iata: origenInfo.iata, nombreIngles: origenInfo.englishName },
            destino: { input: destinationName, oficial: destinationName, slug: destinationSlug, iata: destinoInfo.iata, nombreIngles: destinoInfo.englishName },
            viaje: { ida: departDate, vuelta: returnDateStr || null, pasajeros: passengers, presupuestoPorPersona: globalBudget }
        },
        resultados: {
            vuelos: { totalEncontrados: vuelosResult.flights ? vuelosResult.flights.length : 0, dentroDelPresupuesto: vuelosFiltrados.length, opciones: vuelosFiltrados },
            hoteles: { totalEncontrados: hotelesResult.hotels ? hotelesResult.hotels.length : 0, dentroDelPresupuesto: hotelesFiltrados.length, opciones: hotelesFiltrados },
            actividades: { totalEncontrados: allActivities.length, dentroDelPresupuesto: actividadesFiltradas.length, opciones: actividadesFiltradas }
        }
    };
}

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// 1. Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Microservicio de Scrappers funcionando.' });
});

// 2. Sugerencias (Autocompletado de ciudades)
app.get('/api/sugerencias', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Parámetro 'q' requerido" });
    
    try {
        if (!globalPage) await initBrowser();
        const sugerencias = await fetchSugerenciasDestino(globalPage, query);
        res.json(sugerencias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Vuelos Independiente
app.get('/api/vuelos', async (req, res) => {
    const { origin, destination, departDate, returnDate, passengers = 1 } = req.query;
    if (!origin || !destination || !departDate) return res.status(400).json({ error: "Faltan parámetros: origin, destination, departDate" });
    
    try {
        const result = await scrapeVuelos(origin, destination, departDate, returnDate || '', passengers, () => {});
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Hoteles Independiente
app.get('/api/hoteles', async (req, res) => {
    const { destination, checkin, checkout, adults = 1 } = req.query;
    if (!destination || !checkin || !checkout) return res.status(400).json({ error: "Faltan parámetros: destination, checkin, checkout" });
    
    try {
        const result = await scrapeHoteles(destination, checkin, checkout, adults, () => {});
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Actividades Independiente
app.get('/api/actividades', async (req, res) => {
    const { destinationSlug, destinationName } = req.query;
    if (!destinationSlug || !destinationName) return res.status(400).json({ error: "Faltan parámetros: destinationSlug, destinationName" });
    
    try {
        if (!globalPage) await initBrowser();
        const actResultTC = await scrapeActividadesTC(globalPage, destinationSlug, () => {});
        const slugParts = destinationSlug.split('_');
        const civiCity = slugParts[0] || destinationName;
        const civiCountry = slugParts.length > 1 ? slugParts[slugParts.length - 1] : 'Argentina';
        const actResultCivi = await performCivitatisScrape(globalPage, civiCity, civiCountry, () => {});
        
        let allActivities = [];
        if (!actResultTC.error && actResultTC.activities) allActivities.push(...actResultTC.activities);
        if (actResultCivi.success && actResultCivi.data) allActivities.push(...actResultCivi.data);

        res.json({ totalEncontrados: allActivities.length, opciones: allActivities });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Viaje Completo (Orquestador)
app.post('/api/viaje', async (req, res) => {
    const { originName, destinationName, destinationSlug, departDate, returnDateStr, passengers, budget } = req.body;
    
    if (!originName || !destinationName || !destinationSlug || !departDate || !budget) {
        return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    try {
        if (!globalPage) await initBrowser();
        let resolvedOriginIata = req.body.originIata;
        let resolvedDestinationIata = req.body.destinationIata;
        
        if (!resolvedOriginIata) {
            const sugOri = await fetchSugerenciasDestino(globalPage, originName);
            resolvedOriginIata = sugOri && sugOri.length > 0 ? sugOri[0].iata : originName;
        }
        if (!resolvedDestinationIata) {
            const sugDest = await fetchSugerenciasDestino(globalPage, destinationName);
            resolvedDestinationIata = sugDest && sugDest.length > 0 ? sugDest[0].iata : destinationName;
        }

        const params = {
            originName, destinationName, destinationSlug, departDate, 
            returnDateStr: returnDateStr || '', passengers: parseInt(passengers) || 1, 
            globalBudget: parseInt(String(budget).replace(/[^\d]/g, '')) || Infinity,
            originIata: resolvedOriginIata, destinationIata: resolvedDestinationIata
        };
        
        const result = await runOrchestration(params, globalPage);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`\n========================================================`);
    console.log(`🚀 SERVIDOR MICROSERVICIO DE SCRAPPERS INICIADO 🚀`);
    console.log(`========================================================`);
    console.log(`URL Base: http://localhost:${PORT}`);
    console.log(`Endpoints disponibles:`);
    console.log(`- GET  /api/health`);
    console.log(`- GET  /api/sugerencias?q=cordoba`);
    console.log(`- GET  /api/vuelos?origin=COR&destination=MIA&departDate=2026-10-20`);
    console.log(`- GET  /api/hoteles?destination=Miami&checkin=2026-10-20&checkout=2026-10-28`);
    console.log(`- GET  /api/actividades?destinationSlug=Miami_Estados_Unidos&destinationName=Miami`);
    console.log(`- POST /api/viaje (Caja negra de orquestación)`);
    console.log(`========================================================\n`);
});
