// Errores de dominio de ms3-armado. Cada uno se traduce al envelope:
// { error: { code, message, service, requestId } } por el errorHandler middleware.

const ERROR_STATUS = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    SCRAPING_RESULT_NOT_FOUND: 404,
    CONVERSACION_NOT_FOUND: 404,
    GEMINI_REQUEST_FAILED: 502,
    GEMINI_INVALID_RESPONSE: 502,
    DB_SAVE_ERROR: 500,
    INTERNAL_ERROR: 500
};

export class AppError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.status = ERROR_STATUS[code] || 500;
        this.details = details;
    }
}

export function appError(code, message, details) {
    return new AppError(code, message, details);
}
