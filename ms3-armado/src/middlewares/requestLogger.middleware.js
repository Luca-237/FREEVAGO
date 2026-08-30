// Loguea cada request entrante (método, ruta, IP de origen, status y
// duración), no solo los errores. Pensado para poder ver en vivo cuándo
// pega el Gateway (o quien sea) mientras se prueba la integración.
export function requestLogger(req, res, next) {
    const start = Date.now();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`[ms3-armado] ${req.method} ${req.originalUrl} <- ${ip} :: ${res.statusCode} (${ms}ms) [${req.id}]`);
    });

    next();
}
