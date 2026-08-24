import { Router } from 'express';
import { crearTravelPlan } from '../controllers/travelPlans.controller.js';

const router = Router();

// POST /api/travel-plans { scrapingId, userId }
router.post('/travel-plans', crearTravelPlan);

export default router;
