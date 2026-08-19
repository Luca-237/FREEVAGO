import 'dotenv/config';
import * as readline from 'readline';
import { performSugerencias, performScrape } from '../scrapers/actividades.scraper.js';

// Modo consola interactiva para probar el scraper de actividades a mano.
// Uso: npm run cli:actividades (desde ms2-scraping)
async function runInteractiveConsole() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n--- MODO CONSOLA: Scraper de Actividades (Turismocity + Civitatis) ---');
    const destino = await askQuestion('Destino (ej. Roma, Cordoba, Miami): ');

    console.log('\nBuscando destinos...');
    const { sugerencias, error: errorSugerencias } = await performSugerencias(destino, console.log);

    if (errorSugerencias || !sugerencias || sugerencias.length === 0) {
        console.log('\n[ERROR] No se encontraron destinos para esa búsqueda.');
        rl.close();
        return;
    }

    console.log('\nDestinos encontrados:');
    sugerencias.forEach((dest, index) => {
        console.log(` ${index + 1}. ${dest.displayName} (slug: ${dest.slug})`);
    });

    const seleccion = await askQuestion('\nSelecciona un destino (número): ');
    rl.close();

    const idx = parseInt(seleccion) - 1;
    if (isNaN(idx) || idx < 0 || idx >= sugerencias.length) {
        console.log('Selección inválida.');
        return;
    }
    const elegido = sugerencias[idx];

    console.log(`\nBuscando actividades en ${elegido.displayName}...`);
    const result = await performScrape(elegido.slug, elegido.cityName, console.log);

    if (result.error) {
        console.log(`\n[ERROR FINAL] ${result.error}`);
        return;
    }

    console.log(`\n======================================================`);
    console.log(`RESULTADOS FINALES: ${result.resultsFound} actividades encontradas`);
    console.log(`======================================================`);

    result.activities.forEach((act, idx) => {
        console.log(`\n--- ACTIVIDAD ${idx + 1} [${act.origen}] ---`);
        console.log(`  Título:      ${act.titulo}`);
        console.log(`  Duración:    ${act.duracionEstimada}`);
        console.log(`  Precio p/p:  ${act.precioPorPersona}`);
        console.log(`  Descripción: ${act.descripcionBreve}`);
    });
}

runInteractiveConsole();
