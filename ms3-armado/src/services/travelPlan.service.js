import mongoose from 'mongoose';
import ScrapingResult from '../models/ScrapingResult.model.js';
import ConversacionViaje from '../models/ConversacionViaje.model.js';
import TravelPlan from '../models/TravelPlan.model.js';
import { buildPrompt } from '../utils/promptBuilder.js';
import { generarPropuestas } from './gemini.service.js';
import { appError } from '../utils/appError.js';

export async function armarTravelPlan({ scrapingId, userId }) {
    if (!mongoose.isValidObjectId(scrapingId)) {
        throw appError('VALIDATION_ERROR', 'scrapingId inválido');
    }
    if (!userId || typeof userId !== 'string') {
        throw appError('VALIDATION_ERROR', 'userId inválido');
    }

    // 1. Traer el registro de scraping (vuelos/hoteles/actividades) generado por ms2
    const scraping = await ScrapingResult.findById(scrapingId).lean();
    if (!scraping) {
        throw appError('SCRAPING_RESULT_NOT_FOUND', 'No existe el registro de scraping solicitado');
    }

    // 2. Si el registro referencia la conversación de MS1 (origen, fechas,
    // preferencias), traerla para pasársela a Gemini como contexto.
    //
    // No hay chequeo de "el scraping le pertenece a este usuario" acá: eso
    // requeriría comparar `userId` (string de Clerk, lo inyecta el Gateway
    // en x-user-id) contra `conversacion.usuarioId` (ObjectId interno de la
    // colección `usuarios` de MS1) — son dos espacios de id distintos
    // mientras MS1 no tenga Clerk conectado, así que hoy no hay forma
    // correcta de validar esa igualdad desde acá. La autenticación es
    // responsabilidad del Gateway (ya valida el JWT antes de llegar acá);
    // ms3-armado no reimplementa una identidad propia para esto. Cuando
    // MS1 emita el mismo userId de Clerk en `conversacionesViaje`, este es
    // el lugar para volver a agregar el chequeo de ownership.
    let conversacion = null;
    if (scraping.conversacionViajeId) {
        conversacion = await ConversacionViaje.findById(scraping.conversacionViajeId).lean();
        if (!conversacion) {
            throw appError('CONVERSACION_NOT_FOUND', 'No existe la conversación referenciada por el registro de scraping');
        }
    }

    // 3. Armar el prompt y pedirle a Gemini las 3 propuestas
    const prompt = buildPrompt({
        destinos: scraping.destinos,
        viaje: conversacion?.viaje,
        scraping: {
            vuelos: scraping.vuelos,
            hoteles: scraping.hoteles,
            actividades: scraping.actividades
        }
    });

    const propuestas = await generarPropuestas(prompt);

    // 4. Guardar el TravelPlan, referenciado al usuario (del header, vía
    // Gateway) y al origen de los datos
    try {
        const travelPlan = await TravelPlan.create({
            userId,
            scrapingResultId: scraping._id,
            conversacionViajeId: conversacion?._id,
            destinos: scraping.destinos,
            propuestas,
            geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash'
        });
        return travelPlan;
    } catch (err) {
        throw appError('DB_SAVE_ERROR', `No se pudo guardar el TravelPlan: ${err.message}`);
    }
}
