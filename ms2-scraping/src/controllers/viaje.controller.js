import { armarViaje } from '../services/viaje.service.js';

export async function crearViaje(req, res, next) {
    try {
        const resultado = await armarViaje(req.body);
        res.json({ status: 'success', ...resultado });
    } catch (err) {
        next(err);
    }
}
