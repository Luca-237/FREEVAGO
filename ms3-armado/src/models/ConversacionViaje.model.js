import mongoose from 'mongoose';

const { Schema } = mongoose;

// Espejo de LECTURA de la colección real que llena MS1 (repo
// MicroServicioGrupo2, rama origin/Alejo — collection `conversacionesViaje`).
// Mismo esquema que ms2-scraping/src/models/ConversacionViaje.model.js —
// si uno cambia, hay que actualizar el otro. ms3-armado no escribe acá,
// solo lee para armar el prompt de Gemini.
//
// No validamos nada de Clerk acá: eso lo maneja el Gateway. `usuarioId` es
// hoy un ObjectId interno de la colección `usuarios` de MS1, no un userId
// de Clerk — ver la nota en travelPlan.service.js sobre por qué el chequeo
// de "dueño del plan" no compara contra este campo.
const viajeSchema = new Schema({
    fechaSalida: String,
    fechaFin: String,
    viajeros: {
        cantidadTotal: Number
    },
    presupuesto: {
        monto: Number,
        moneda: String
    },
    lugarSalida: {
        ciudad: String,
        provincia: String,
        pais: String
    },
    destino: {
        lugaresPreferidos: [{
            ciudad: String,
            provincia: String,
            pais: String,
            region: String
        }],
        destinosAbiertos: Boolean
    },
    preferencias: Schema.Types.Mixed
}, { _id: false, strict: false });

const conversacionViajeSchema = new Schema({
    usuarioId: { type: Schema.Types.ObjectId, required: true },
    viaje: viajeSchema,
    estado: { type: String, enum: ['en_progreso', 'completo'] }
}, { timestamps: true, collection: 'conversacionesViaje', strict: false });

export default mongoose.models.ConversacionViaje || mongoose.model('ConversacionViaje', conversacionViajeSchema);
