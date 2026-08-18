// Script de prueba: inserta un UserSelection + ScrapingResult de ejemplo
// en la base configurada por MONGO_URI (debería ser la de test) para poder
// pegarle al endpoint POST /api/travel-plans con IDs válidos.
//
// Uso: node scripts/seed.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import ScrapingResult from '../src/models/ScrapingResult.model.js';
import UserSelection from '../src/models/UserSelection.model.js';

async function main() {
    await connectDB();
    console.log(`[seed] Conectado a: ${mongoose.connection.name}`);

    const userId = new mongoose.Types.ObjectId();

    const userSelection = await UserSelection.create({
        userId,
        origenCiudad: 'Córdoba',
        fechaIda: '2026-10-10',
        fechaVuelta: '2026-10-15',
        cantidadPersonas: 2,
        presupuesto: 500000,
        preferencias: { tipoViaje: 'relax', intereses: ['playa', 'gastronomia'] }
    });

    const scrapingResult = await ScrapingResult.create({
        destinos: ['Asunción'],
        vuelos: [
            {
                destino: 'Asunción',
                origin: 'COR',
                destination: 'ASU',
                departDate: '2026-10-10',
                price: 'ARS 120000',
                legs: [{ time: '08:00 - 10:30', airline: 'Aerolíneas Test', stops: 'Directo' }],
                rawText: 'ARS 120000 | 08:00 - 10:30 | Aerolíneas Test | Directo'
            }
        ],
        hoteles: [
            {
                destino: 'Asunción',
                name: 'Hotel Test Plaza',
                price: 'ARS 40000',
                rating: '8,5',
                rawText: 'Hotel Test Plaza | ARS 40000 | 8,5'
            }
        ],
        actividades: [
            { destino: 'Asunción', nombre: 'City tour', precio: 'ARS 8000', categoria: 'turismo' }
        ],
        userSelection: userSelection._id
    });

    console.log('\n[seed] Documentos creados:');
    console.log('  userId:      ', userId.toString());
    console.log('  userSelection:', userSelection._id.toString());
    console.log('  scrapingResult:', scrapingResult._id.toString());

    console.log('\n[seed] Probá con:');
    console.log(`curl -s -X POST http://localhost:${process.env.PORT || 3002}/api/travel-plans \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"scrapingId":"${scrapingResult._id}","userId":"${userId}"}'`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('[seed] Error:', err);
    process.exit(1);
});
