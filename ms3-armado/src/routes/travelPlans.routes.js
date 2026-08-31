import { Router } from 'express';
import { crearTravelPlan } from '../controllers/travelPlans.controller.js';

const router = Router();

// POST /api/travels { scrapingId } + header x-user-id
// (No es /api/travel-plans: esa ruta está tomada por MS1 en la tabla de
// ruteo del Gateway. "travels" es el path que le corresponde a MS3 —
// puede volver a cambiar si se resuelve distinto la colisión del Glosario.)
router.post('/travels', crearTravelPlan);

export default router;
