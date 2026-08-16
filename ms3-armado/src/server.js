import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 3002;

async function start() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`[ms3-armado] Servidor iniciado en http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('[ms3-armado] Error fatal al arrancar:', err);
        process.exit(1);
    }
}

start();
