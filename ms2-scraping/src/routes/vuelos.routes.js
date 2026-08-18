import { Router } from 'express';
import { performScrape } from '../scrapers/vuelos.scraper.js';
import { appError } from '../utils/appError.js';

const router = Router();

// GET /api/vuelos?origin=COR,BUE&destination=ASU&departDate=2026-10-15&returnDate=&passengers=1
router.get('/vuelos', async (req, res, next) => {
    try {
        const { origin, destination, departDate, returnDate, passengers = 1 } = req.query;
        if (!origin || !destination || !departDate) {
            throw appError('VALIDATION_ERROR', 'Faltan parámetros: origin, destination, departDate');
        }

        console.log(`\n[API] Petición recibida: ${origin} a ${destination} (${departDate})`);
        const result = await performScrape(origin, destination, departDate, returnDate || '', passengers, (msg) => console.log(msg));

        if (result.error) {
            throw appError('SCRAPING_FAILED', result.error);
        }
        res.json({ status: 'success', ...result });
    } catch (err) {
        next(err);
    }
});

export default router;
