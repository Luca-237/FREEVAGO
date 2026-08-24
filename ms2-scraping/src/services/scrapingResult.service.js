import mongoose from 'mongoose';
import ScrapingResult from '../models/ScrapingResult.model.js';
import UserSelection from '../models/UserSelection.model.js';
import { performScrape as performScrapeVuelos } from '../scrapers/vuelos.scraper.js';
import { performScrape as performScrapeHoteles } from '../scrapers/hoteles.scraper.js';
import { performScrapeAuto as performScrapeActividades } from '../scrapers/actividades.scraper.js';
import { appError } from '../utils/appError.js';

// Corre el scraper de vuelos, hoteles y actividades para cada destino, arma
// UN ScrapingResult con todo junto y lo guarda. Si algún destino falla en
// alguna fuente (sitio caído, sin resultados, etc.) no aborta todo el
// pedido: lo registra en "warnings" y sigue con el resto. Solo falla si al
// final no quedó ningún vuelo ni hotel utilizable (actividades es opcional).
export async function generarYGuardarScraping({ destinos, origen, fechaIda, fechaVuelta, pasajeros, userSelectionId }) {
    if (!Array.isArray(destinos) || destinos.length < 1 || destinos.length > 3) {
        throw appError('VALIDATION_ERROR', 'destinos debe ser un array de 1 a 3 elementos');
    }
    if (!origen || !fechaIda) {
        throw appError('VALIDATION_ERROR', 'Faltan parámetros: origen, fechaIda');
    }
    if (!mongoose.isValidObjectId(userSelectionId)) {
        throw appError('VALIDATION_ERROR', 'userSelectionId inválido');
    }

    const userSelection = await UserSelection.findById(userSelectionId).lean();
    if (!userSelection) {
        throw appError('USER_SELECTION_NOT_FOUND', 'No existe la selección de usuario referenciada');
    }

    const vuelos = [];
    const hoteles = [];
    const actividades = [];
    const warnings = [];
    const pax = pasajeros || 1;

    for (const destino of destinos) {
        const log = (msg) => console.log(`[scraping-results:${destino}] ${msg}`);

        const vueloResult = await performScrapeVuelos(origen, destino, fechaIda, fechaVuelta || '', pax, log);
        if (vueloResult.error) {
            warnings.push({ destino, tipo: 'vuelos', error: vueloResult.error });
        } else {
            for (const f of vueloResult.flights) {
                vuelos.push({
                    destino,
                    origin: vueloResult.origin,
                    destination: vueloResult.destination,
                    departDate: vueloResult.departDate,
                    price: f.price,
                    legs: f.legs,
                    rawText: f.rawText
                });
            }
        }

        const hotelResult = await performScrapeHoteles(destino, fechaIda, fechaVuelta || null, pax, log);
        if (hotelResult.error) {
            warnings.push({ destino, tipo: 'hoteles', error: hotelResult.error });
        } else {
            for (const h of hotelResult.hotels) {
                hoteles.push({
                    destino,
                    name: h.name,
                    price: h.price,
                    rating: h.rating,
                    rawText: h.rawText
                });
            }
        }

        const actividadResult = await performScrapeActividades(destino, log);
        if (actividadResult.error) {
            warnings.push({ destino, tipo: 'actividades', error: actividadResult.error });
        } else {
            for (const a of actividadResult.activities) {
                actividades.push({
                    destino,
                    nombre: a.titulo,
                    descripcion: a.descripcionBreve,
                    precio: a.precioPorPersona,
                    categoria: a.origen
                });
            }
        }
    }

    if (vuelos.length === 0 && hoteles.length === 0) {
        throw appError('SCRAPING_FAILED', 'No se pudo obtener ningún resultado (vuelos ni hoteles) para los destinos pedidos', warnings);
    }

    try {
        const scrapingResult = await ScrapingResult.create({
            destinos,
            vuelos,
            hoteles,
            actividades,
            userSelection: userSelectionId
        });
        return { scrapingResult, warnings };
    } catch (err) {
        throw appError('DB_SAVE_ERROR', `No se pudo guardar el ScrapingResult: ${err.message}`);
    }
}
