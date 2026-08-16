import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`[ms2-scraping] Servidor iniciado en http://localhost:${PORT}`);
    console.log(`Ejemplo: http://localhost:${PORT}/api/vuelos?origin=COR,BUE&destination=ASU&departDate=2026-10-15`);
});
