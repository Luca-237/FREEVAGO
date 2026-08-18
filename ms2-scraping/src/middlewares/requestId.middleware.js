import { randomUUID } from 'crypto';

// Asigna un requestId único a cada request (o reusa el que venga de otro
// servicio en X-Request-Id, para poder trazar la cadena entre microservicios).
export function requestId(req, res, next) {
    req.id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
}
