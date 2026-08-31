// Script de prueba: inserta una ConversacionViaje (simulando lo que guarda
// MS1) + un ScrapingResult de ejemplo en la base configurada por MONGO_URI
// (debería ser la de test) para poder pegarle al endpoint POST /api/travels
// con IDs válidos, sin depender de que MS1/MS2 estén corriendo.
//
// Uso: node scripts/seed.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import ScrapingResult from '../src/models/ScrapingResult.model.js';
import ConversacionViaje from '../src/models/ConversacionViaje.model.js';

async function main() {
    await connectDB();
    console.log(`[seed] Conectado a: ${mongoose.connection.name}`);

    // userId "de negocio" que va a viajar en el header x-user-id (Gateway →
    // Clerk). No es lo mismo que ConversacionViaje.usuarioId de abajo: ese es
    // el ObjectId interno de la colección `usuarios` de MS1 (todavía sin
    // Clerk conectado). Un string con forma de id de Clerk, no un ObjectId,
    // para no acostumbrarnos a probar con la forma equivocada.
    const userId = 'user_test_1';

    const conversacion = await ConversacionViaje.create({
        usuarioId: new mongoose.Types.ObjectId(),
        estado: 'completo',
        viaje: {
            fechaSalida: '2026-10-10',
            fechaFin: '2026-10-15',
            viajeros: { cantidadTotal: 2 },
            presupuesto: { monto: 500000, moneda: 'ARS' },
            lugarSalida: { ciudad: 'Córdoba', provincia: 'Córdoba', pais: 'Argentina' },
            destino: {
                lugaresPreferidos: [{ ciudad: 'Asunción', pais: 'Paraguay' }],
                destinosAbiertos: false
            },
            preferencias: { tipoViaje: ['relax'], intereses: ['playa', 'gastronomia'] }
        }
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
        conversacionViajeId: conversacion._id
    });

    console.log('\n[seed] Documentos creados:');
    console.log('  userId (x-user-id, string):', userId);
    console.log('  conversacionViaje:', conversacion._id.toString());
    console.log('  scrapingResult:   ', scrapingResult._id.toString());

    console.log('\n[seed] Probá con:');
    console.log(`curl -s -X POST http://localhost:${process.env.PORT || 3004}/api/travels \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "x-user-id: ${userId}" \\`);
    console.log(`  -d '{"scrapingId":"${scrapingResult._id}"}'`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('[seed] Error:', err);
    process.exit(1);
});
