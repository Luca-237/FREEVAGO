import 'dotenv/config';
import * as readline from 'readline';
import { performScrape } from '../scrapers/vuelos.scraper.js';

// Modo consola interactiva para probar el scraper de vuelos a mano.
// Uso: npm run cli (desde ms2-scraping)
async function runInteractiveConsole() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n--- MODO CONSOLA: Scraper de Booking (Vuelos) ---');
    const origin = await askQuestion('Origen (ej. COR, o BUE,COR): ');
    const destination = await askQuestion('Destino (ej. ASU): ');
    const departDate = await askQuestion('Fecha de Ida (ej. 2026-10-10): ');
    const returnDate = await askQuestion('Fecha de Vuelta (Opcional): ');
    const passengers = await askQuestion('Cantidad de personas (ej. 1): ');
    rl.close();

    console.log('\nIniciando búsqueda...');
    const result = await performScrape(origin, destination, departDate, returnDate, passengers, console.log);

    if (result.error) {
        console.log(`\n[ERROR FINAL] ${result.error}`);
        return;
    }

    console.log(`\n======================================================`);
    console.log(`RESULTADOS FINALES: ${result.resultsFound} opciones encontradas`);
    console.log(`======================================================`);

    result.flights.forEach((flightObj, idx) => {
        let output = `\nOPCIÓN ${idx + 1}\nPrecio: ${flightObj.price}\n`;
        if (flightObj.legs.length === 0) {
            output += `   Formato no estándar: ${flightObj.rawText.substring(0, 80)}...\n`;
        } else {
            flightObj.legs.forEach((leg, i) => {
                output += `   Tramo ${i + 1} (${leg.route || 'Ruta'}): ${leg.airline}\n`;
                output += `   Horario: ${leg.time} Duración: ${leg.duration}\n`;
                output += `   ${leg.stops} ${leg.layover ? ' -> ' + leg.layover : ''}\n`;
            });
        }
        console.log(output);
    });
}

runInteractiveConsole();
