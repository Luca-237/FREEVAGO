import { generarYGuardarScraping } from '../services/scrapingResult.service.js';
import { appError } from '../utils/appError.js';

export async function crearScrapingResult(req, res, next) {
    try {
        const { destinos, origen, fechaIda, fechaVuelta, pasajeros, userSelectionId } = req.body;

        if (!destinos || !origen || !fechaIda || !userSelectionId) {
            throw appError('VALIDATION_ERROR', 'Faltan parámetros: destinos, origen, fechaIda, userSelectionId');
        }

        const { scrapingResult, warnings } = await generarYGuardarScraping({
            destinos, origen, fechaIda, fechaVuelta, pasajeros, userSelectionId
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
