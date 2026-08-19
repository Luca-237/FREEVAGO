import { Router } from 'express';
import { crearViaje } from '../controllers/viaje.controller.js';

const router = Router();

// POST /api/viaje — orquestador de prueba: busca vuelos + hoteles +
// actividades para un destino y filtra por presupuesto, todo en una sola
// llamada. No persiste en Mongo (para eso está POST /api/scraping-results).
router.post('/viaje', crearViaje);

export default router;
