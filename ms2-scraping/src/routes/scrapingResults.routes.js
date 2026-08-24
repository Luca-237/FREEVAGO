import { Router } from 'express';
import { crearScrapingResult } from '../controllers/scrapingResults.controller.js';

const router = Router();

// POST /api/scraping-results { destinos, origen, fechaIda, fechaVuelta, pasajeros, userSelectionId }
router.post('/scraping-results', crearScrapingResult);

export default router;
