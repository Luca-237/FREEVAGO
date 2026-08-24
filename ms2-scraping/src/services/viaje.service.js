import { obtenerCoordenadas } from './geocoding.service.js';
import { obtenerAeropuertosPorPais } from './airports.service.js';
import { encontrarMasCercano } from '../utils/haversine.util.js';
import { performScrape as performScrapeVuelos } from '../scrapers/vuelos.scraper.js';
import { performScrape as performScrapeHoteles } from '../scrapers/hoteles.scraper.js';
import { performScrape as performScrapeActividades } from '../scrapers/actividades.scraper.js';
import { appError } from '../utils/appError.js';

// Resuelve el código IATA del aeropuerto más cercano a una ciudad. Misma
// lógica que middlewares/codigoAeropuerto.middleware.js, pero como función
// directa: acá la necesitamos llamar dos veces (origen y destino), no una
// sola vez atada a req.body.origin.
async function resolverIata(nombreCiudad) {
    const datosGeo = await obtenerCoordenadas(nombreCiudad);
    if (!datosGeo) {
        throw appError('AIRPORT_RESOLUTION_FAILED', `No se pudo geolocalizar "${nombreCiudad}"`);
    }

    const aeropuertos = await obtenerAeropuertosPorPais(datosGeo.country);
    if (!aeropuertos || aeropuertos.length === 0) {
        throw appError('AIRPORT_RESOLUTION_FAILED', `No se encontraron aeropuertos para el país de "${nombreCiudad}"`);
    }

    const masCercano = encontrarMasCercano(datosGeo.latitude, datosGeo.longitude, aeropuertos);
    if (!masCercano) {
        throw appError('AIRPORT_RESOLUTION_FAILED', `No se pudo determinar el aeropuerto más cercano a "${nombreCiudad}"`);
    }

    return masCercano.iata;
}

// Convierte un precio scrapeado (string, sin normalizar todavía en el resto
// del sistema) a número para poder filtrar por presupuesto. "Gratis" -> 0.
function parsePrice(priceStr) {
    if (!priceStr || typeof priceStr !== 'string') return 0;
    if (priceStr.toLowerCase().includes('gratis') || priceStr.toLowerCase().includes('free')) return 0;
    const numStr = priceStr.replace(/[^\d]/g, '');
    return numStr ? parseInt(numStr, 10) : 0;
}

// Orquestador de prueba: junta vuelos + hoteles + actividades para un
// destino en una sola llamada, filtrados por presupuesto. Pensado para
// testear rápido o para que el frontend arme una búsqueda simple sin tener
// que pegarle a los tres endpoints por separado. NO persiste en Mongo — para
// el flujo real que alimenta a MS3 se usa POST /api/scraping-results.
export async function armarViaje({
    originName, originIata, destinationName, destinationIata, destinationSlug,
    departDate, returnDateStr, passengers, budget
}) {
    if (!originName || !destinationName || !destinationSlug || !departDate || budget === undefined) {
        throw appError('VALIDATION_ERROR', 'Faltan parámetros: originName, destinationName, destinationSlug, departDate, budget');
    }

    const pax = passengers || 1;
    const presupuesto = parseInt(String(budget).replace(/[^\d]/g, ''), 10) || Infinity;

    const [origenIata, destinoIata] = await Promise.all([
        originIata || resolverIata(originName),
        destinationIata || resolverIata(destinationName)
    ]);

    const log = (msg) => console.log(`[viaje] ${msg}`);

    const [vuelosResult, hotelesResult, actividadesResult] = await Promise.all([
        performScrapeVuelos(origenIata, destinoIata, departDate, returnDateStr || '', pax, log),
        performScrapeHoteles(destinationName, departDate, returnDateStr || null, pax, log),
        performScrapeActividades(destinationSlug, destinationName, log)
    ]);

    const vuelos = !vuelosResult.error && vuelosResult.flights
        ? vuelosResult.flights.filter(v => parsePrice(v.price) <= presupuesto)
        : [];

    const hoteles = !hotelesResult.error && hotelesResult.hotels
        ? hotelesResult.hotels.filter(h => (parsePrice(h.price) / pax) <= presupuesto)
        : [];

    const actividades = !actividadesResult.error && actividadesResult.activities
        ? actividadesResult.activities.filter(a => parsePrice(a.precioPorPersona) <= presupuesto)
        : [];

    return {
        metadata: {
            origen: { nombre: originName, iata: origenIata },
            destino: { nombre: destinationName, iata: destinoIata, slug: destinationSlug },
            viaje: { ida: departDate, vuelta: returnDateStr || null, pasajeros: pax, presupuestoPorPersona: presupuesto }
        },
        resultados: {
            vuelos: {
                totalEncontrados: vuelosResult.flights?.length || 0,
                dentroDelPresupuesto: vuelos.length,
                opciones: vuelos,
                error: vuelosResult.error || null
            },
            hoteles: {
                totalEncontrados: hotelesResult.hotels?.length || 0,
                dentroDelPresupuesto: hoteles.length,
                opciones: hoteles,
                error: hotelesResult.error || null
            },
            actividades: {
                totalEncontrados: actividadesResult.activities?.length || 0,
                dentroDelPresupuesto: actividades.length,
                opciones: actividades,
                error: actividadesResult.error || null
            }
        }
    };
}
