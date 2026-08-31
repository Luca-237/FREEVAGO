import { generarYGuardarScraping } from '../services/scrapingResult.service.js';
import { appError } from '../utils/appError.js';

export async function crearScrapingResult(req, res, next) {
    try {
        // "destinos" es opcional: si no se manda, se deriva de
        // viaje.destino.lugaresPreferidos de la conversación. Todo lo demás
        // (origen, fechas, pasajeros) sale directo de esa misma conversación,
        // ya no hace falta que el caller los mande sueltos.
        const { conversacionId, destinos, pasajeros } = req.body;

        if (!conversacionId) {
            throw appError('VALIDATION_ERROR', 'Falta parámetro: conversacionId');
        }

        const { scrapingResult, warnings } = await generarYGuardarScraping({
            conversacionId, destinos, pasajeros
        });

        // 200 (no 201): el caller necesita el id del ScrapingResult recién
        // generado para pasárselo después a ms3-armado.
        res.status(200).json({
            status: 'success',
            scrapingResultId: scrapingResult._id,
            scrapingResult,
            warnings
        });
    } catch (err) {
        next(err);
    }
}
