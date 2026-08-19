import { Router } from 'express';
import { performScrape } from '../scrapers/hoteles.scraper.js';
import { appError } from '../utils/appError.js';

const router = Router();

// GET /api/hoteles?destination=Miami&checkin=2026-10-20&checkout=2026-10-28&adults=1
router.get('/hoteles', async (req, res, next) => {
    try {
        const { destination, checkin, checkout, adults = 1 } = req.query;
        if (!destination || !checkin || !checkout) {
            throw appError('VALIDATION_ERROR', 'Faltan parámetros: destination, checkin, checkout');
        }

        console.log(`\n[API] Petición recibida: ${destination} (${checkin} al ${checkout})`);
        const result = await performScrape(destination, checkin, checkout, adults, (msg) => console.log(msg));

        if (result.error) {
            throw appError('SCRAPING_FAILED', result.error);
        }
        res.json({ status: 'success', ...result });
    } catch (err) {
        next(err);
    }
});

export default router;
