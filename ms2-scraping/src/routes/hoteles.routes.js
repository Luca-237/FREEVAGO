import { Router } from 'express';
import { performScrape } from '../scrapers/hoteles.scraper.js';
import { appError } from '../utils/appError.js';

const router = Router();

// GET /api/hoteles/destino?destination=Miami&adults=1
router.get('/hoteles/destino', async (req, res, next) => {
    try {
        const { destination, adults = 1 } = req.query;
        if (!destination) {
            throw appError('VALIDATION_ERROR', 'Falta parámetro: destination');
        }

        console.log(`\n[API] Petición recibida (Solo destino): ${destination}`);
        const result = await performScrape(destination, null, null, adults, (msg) => console.log(msg));

        if (result.error) {
            throw appError('SCRAPING_FAILED', result.error);
        }
        res.json({ status: 'success', ...result });
    } catch (err) {
        next(err);
    }
});

// GET /api/hoteles/fecha?destination=Miami&checkin=2026-08-12&checkout=2026-08-13&adults=1
router.get('/hoteles/fecha', async (req, res, next) => {
    try {
        const { destination, checkin, checkout, adults = 1 } = req.query;
        if (!destination || !checkin || !checkout) {
            throw appError('VALIDATION_ERROR', 'Faltan parámetros: destination, checkin, checkout');
        }

        console.log(`\n[API] Petición recibida (Con fechas): ${destination} (${checkin} al ${checkout})`);
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
