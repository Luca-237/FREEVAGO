import { armarTravelPlan } from '../services/travelPlan.service.js';
import { appError } from '../utils/appError.js';

export async function crearTravelPlan(req, res, next) {
    try {
        const { scrapingId, userId } = req.body;
        if (!scrapingId || !userId) {
            throw appError('VALIDATION_ERROR', 'Faltan parámetros: scrapingId, userId');
        }

        const travelPlan = await armarTravelPlan({ scrapingId, userId });
        res.status(201).json({ status: 'success', travelPlan });
    } catch (err) {
        next(err);
    }
}
