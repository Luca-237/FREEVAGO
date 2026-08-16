import { Router } from 'express';
import { performScrape } from '../scrapers/vuelos.scraper.js';

const router = Router();

// GET /api/vuelos?origin=COR,BUE&destination=ASU&departDate=2026-10-15&returnDate=&passengers=1
router.get('/vuelos', async (req, res) => {
    const { origin, destination, departDate, returnDate, passengers = 1 } = req.query;
    if (!origin || !destination || !departDate) {
        return res.status(400).json({ error: 'Faltan parámetros: origin, destination, departDate' });
    }

    console.log(`\n[API] Petición recibida: ${origin} a ${destination} (${departDate})`);
    const result = await performScrape(origin, destination, departDate, returnDate || '', passengers, (msg) => console.log(msg));

    if (result.error) {
        return res.status(404).json({ error: result.error });
    }
    res.json({ status: 'success', ...result });
});

export default router;
