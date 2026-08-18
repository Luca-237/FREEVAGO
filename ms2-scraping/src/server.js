import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 3000;

async function start() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`[ms2-scraping] Servidor iniciado en http://localhost:${PORT}`);
            console.log(`Ejemplo: http://localhost:${PORT}/api/vuelos?origin=COR,BUE&destination=ASU&departDate=2026-10-15`);
        });
    } catch (err) {
        console.error('[ms2-scraping] Error fatal al arrancar:', err);
        process.exit(1);
    }
}

start();
