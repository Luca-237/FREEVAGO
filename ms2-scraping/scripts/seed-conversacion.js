// Script de prueba: crea una ConversacionViaje "completo" en el Mongo real
// para poder pegarle a POST /api/scraping-results con un conversacionId
// válido, sin depender de que MS1 esté corriendo. Mismos datos de ejemplo
// que usa ms3-armado/scripts/seed.js, para que ambos scripts de prueba
// queden consistentes entre sí.
// Uso: node scripts/seed-conversacion.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import ConversacionViaje from '../src/models/ConversacionViaje.model.js';

async function main() {
    await connectDB();
    console.log(`[seed] Conectado a: ${mongoose.connection.name}`);

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

    console.log('\n[seed] conversacionId:', conversacion._id.toString());
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('[seed] Error:', err);
    process.exit(1);
});
