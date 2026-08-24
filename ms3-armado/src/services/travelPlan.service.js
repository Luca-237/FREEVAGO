import mongoose from 'mongoose';
import ScrapingResult from '../models/ScrapingResult.model.js';
import UserSelection from '../models/UserSelection.model.js';
import TravelPlan from '../models/TravelPlan.model.js';
import { buildPrompt } from '../utils/promptBuilder.js';
import { generarPropuestas } from './gemini.service.js';
import { appError } from '../utils/appError.js';

export async function armarTravelPlan({ scrapingId, userId }) {
    if (!mongoose.isValidObjectId(scrapingId)) {
        throw appError('VALIDATION_ERROR', 'scrapingId inválido');
    }
    if (!mongoose.isValidObjectId(userId)) {
        throw appError('VALIDATION_ERROR', 'userId inválido');
    }

    // 1. Traer el registro de scraping (vuelos/hoteles/actividades) generado por ms2
    const scraping = await ScrapingResult.findById(scrapingId).lean();
    if (!scraping) {
        throw appError('SCRAPING_RESULT_NOT_FOUND', 'No existe el registro de scraping solicitado');
    }

    // 2. Si el registro referencia una selección de usuario (origen, fechas, preferencias), traerla
    let userSelection = null;
    if (scraping.userSelection) {
        userSelection = await UserSelection.findById(scraping.userSelection).lean();
        if (!userSelection) {
            throw appError('USER_SELECTION_NOT_FOUND', 'No existe la selección de usuario referenciada por el registro de scraping');
        }
    }

    // 3. Armar el prompt y pedirle a Gemini las 3 propuestas
    const prompt = buildPrompt({
        destinos: scraping.destinos,
        userSelection,
        scraping: {
            vuelos: scraping.vuelos,
            hoteles: scraping.hoteles,
            actividades: scraping.actividades
        }
    });

    const propuestas = await generarPropuestas(prompt);

    // 4. Guardar el TravelPlan, referenciado al usuario y al origen de los datos
    try {
        const travelPlan = await TravelPlan.create({
            userId,
            scrapingResultId: scraping._id,
            userSelectionId: userSelection?._id,
            destinos: scraping.destinos,
            propuestas,
            geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash'
        });
        return travelPlan;
    } catch (err) {
        throw appError('DB_SAVE_ERROR', `No se pudo guardar el TravelPlan: ${err.message}`);
    }
}
