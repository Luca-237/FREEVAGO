import { Router } from 'express';
import { performScrape } from '../scrapers/hoteles.scraper.js';

const router = Router();

// GET /api/hoteles/destino?destination=Miami&adults=1
router.get('/hoteles/destino', async (req, res) => {
    const { destination, adults = 1 } = req.query;
    if (!destination) {
        return res.status(400).json({ error: 'Falta parámetro: destination' });
    }

    console.log(`\n[API] Petición recibida (Solo destino): ${destination}`);
    const result = await performScrape(destination, null, null, adults, (msg) => console.log(msg));

    if (result.error) {
        return res.status(404).json({ error: result.error });
    }
    res.json({ status: 'success', ...result });
});

// GET /api/hoteles/fecha?destination=Miami&checkin=2026-08-12&checkout=2026-08-13&adults=1
router.get('/hoteles/fecha', async (req, res) => {
    const { destination, checkin, checkout, adults = 1 } = req.query;
    if (!destination || !checkin || !checkout) {
        return res.status(400).json({ error: 'Faltan parámetros: destination, checkin, checkout' });
    }

    console.log(`\n[API] Petición recibida (Con fechas): ${destination} (${checkin} al ${checkout})`);
    const result = await performScrape(destination, checkin, checkout, adults, (msg) => console.log(msg));

    if (result.error) {
        return res.status(404).json({ error: result.error });
    }
    res.json({ status: 'success', ...result });
});

export default router;
