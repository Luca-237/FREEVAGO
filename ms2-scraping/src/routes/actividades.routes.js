import { Router } from 'express';
import { performScrape } from '../scrapers/actividades.scraper.js';
import { appError } from '../utils/appError.js';

const router = Router();

// GET /api/actividades?destinationSlug=Miami_Estados_Unidos&destinationName=Miami
router.get('/actividades', async (req, res, next) => {
    try {
        const { destinationSlug, destinationName } = req.query;
        if (!destinationSlug || !destinationName) {
            throw appError('VALIDATION_ERROR', 'Faltan parámetros: destinationSlug, destinationName');
        }

        console.log(`\n[API] Petición de actividades: ${destinationSlug}`);
        const result = await performScrape(destinationSlug, destinationName, (msg) => console.log(msg));

        if (result.error) {
            throw appError('SCRAPING_FAILED', result.error);
        }
        res.json({ status: 'success', ...result });
    } catch (err) {
        next(err);
    }
});

export default router;
