import { Router } from 'express';
import { crearScrapingResult } from '../controllers/scrapingResults.controller.js';

const router = Router();

// POST /api/scraping-results { conversacionId, destinos?, pasajeros? }
// conversacionId apunta a un documento de MS1 (collection conversacionesViaje,
// estado: "completo"). destinos es opcional: si no se manda, se deriva de
// viaje.destino.lugaresPreferidos.
router.post('/scraping-results', crearScrapingResult);

export default router;
