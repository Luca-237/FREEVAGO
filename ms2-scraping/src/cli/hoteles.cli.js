import 'dotenv/config';
import * as readline from 'readline';
import { performScrape } from '../scrapers/hoteles.scraper.js';

// Modo consola interactiva para probar el scraper de hoteles a mano.
// Uso: npm run cli:hoteles (desde ms2-scraping)
async function runInteractiveConsole() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n--- MODO CONSOLA: Scraper de Booking (Hoteles) ---');
    const destination = await askQuestion('Destino (ej. Villa Carlos Paz, Argentina): ');
    const checkin = await askQuestion('Fecha de Check-in (ej. 2026-08-12): ');
    const checkout = await askQuestion('Fecha de Check-out (ej. 2026-08-13): ');
    const adults = await askQuestion('Cantidad de adultos (ej. 1): ');
    rl.close();

    console.log('\nIniciando búsqueda...');
    const result = await performScrape(destination, checkin, checkout, adults, console.log);

    if (result.error) {
        console.log(`\n[ERROR FINAL] ${result.error}`);
        return;
    }

    console.log(`\n======================================================`);
    console.log(`RESULTADOS FINALES: ${result.resultsFound} opciones encontradas`);
    console.log(`======================================================`);

    result.hotels.forEach((hotelObj, idx) => {
        let output = `\nOPCIÓN ${idx + 1}\nNombre aprox: ${hotelObj.name}\nPrecio: ${hotelObj.price}\nPuntuación: ${hotelObj.rating}\nTexto crudo: ${hotelObj.rawText.substring(0, 120)}...\n`;
        console.log(output);
    });
}

runInteractiveConsole();
