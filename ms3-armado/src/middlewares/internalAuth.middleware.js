import { appError } from '../utils/appError.js';

// Rechaza con 401 cualquier request cuyo x-internal-key no coincida con el
// secreto compartido entre el Gateway y los microservicios. Objetivo: que
// nadie le pegue a ms3-armado salteando el Gateway (y su validación de JWT).
// No se aplica a /health (ver app.js).
export function internalAuth(req, res, next) {
    const key = req.headers['x-internal-key'];
    const expected = process.env.INTERNAL_KEY;

    if (!expected) {
        // Falta de configuración nuestra, no del caller: no la tratamos
        // como 401 para no confundir "no configuramos el secreto" con
        // "el caller mandó uno inválido".
        return next(new Error('Falta INTERNAL_KEY en el .env de ms3-armado'));
    }

    if (!key || key !== expected) {
        return next(appError('UNAUTHORIZED', 'x-internal-key ausente o inválida'));
    }

    next();
}
