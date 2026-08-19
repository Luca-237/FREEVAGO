import { Router } from 'express';
import { performSugerencias } from '../scrapers/actividades.scraper.js';
import { appError } from '../utils/appError.js';

const router = Router();

// GET /api/sugerencias?q=miami
// Autocompletado de destino: para que el front ofrezca opciones mientras el
// usuario tipea, con el slug e iata ya resueltos para pasarle después a
// /api/actividades o /api/viaje.
router.get('/sugerencias', async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) {
            throw appError('VALIDATION_ERROR', "Falta parámetro: q");
        }

        const result = await performSugerencias(q, (msg) => console.log(msg));
        if (result.error) {
            throw appError('SCRAPING_FAILED', result.error);
        }
        res.json({ status: 'success', sugerencias: result.sugerencias });
    } catch (err) {
        next(err);
    }
});

export default router;
