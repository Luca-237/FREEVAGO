import { AppError } from '../utils/appError.js';

const SERVICE_NAME = 'ms2-scraping';

export function notFoundHandler(req, res) {
    res.status(404).json({
        error: {
            code: 'ROUTE_NOT_FOUND',
            message: `No existe la ruta ${req.method} ${req.originalUrl}`,
            service: SERVICE_NAME,
            requestId: req.id
        }
    });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        console.error(`[${SERVICE_NAME}] ${err.code}: ${err.message}`, err.details ?? '');
        return res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
                service: SERVICE_NAME,
                requestId: req.id
            }
        });
    }

    console.error(`[${SERVICE_NAME}] INTERNAL_ERROR:`, err);
    res.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Error interno inesperado',
            service: SERVICE_NAME,
            requestId: req.id
        }
    });
}
