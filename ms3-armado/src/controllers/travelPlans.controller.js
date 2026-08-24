import { armarTravelPlan } from '../services/travelPlan.service.js';
import { appError } from '../utils/appError.js';

export async function crearTravelPlan(req, res, next) {
    try {
        // El dueño del recurso sale del header que inyecta el Gateway
        // (ya validó el JWT de Clerk), no de lo que mande el body.
        const userId = req.headers['x-user-id'];
        const { scrapingId } = req.body;

        if (!userId) {
            throw appError('VALIDATION_ERROR', 'Falta el header x-user-id');
        }
        if (!scrapingId) {
            throw appError('VALIDATION_ERROR', 'Falta el parámetro: scrapingId');
        }

        const travelPlan = await armarTravelPlan({ scrapingId, userId });
        res.status(201).json({ status: 'success', travelPlan });
    } catch (err) {
        next(err);
    }
}
