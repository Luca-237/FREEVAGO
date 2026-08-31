import mongoose from 'mongoose';

const { Schema } = mongoose;

// Espejo de LECTURA de la colección real que llena MS1 (repo
// MicroServicioGrupo2, rama origin/Alejo — collection `conversacionesViaje`).
// Reemplaza al viejo UserSelection.model.js: esa colección (`userSelections`)
// nunca la escribió nadie, así que ms2-scraping pasa a leer directamente lo
// que MS1 sí guarda. Si MS1 cambia esa colección, hay que actualizar esto
// (y su mismo espejo en ms3-armado/src/models/ConversacionViaje.model.js).
//
// No validamos nada de Clerk acá: mientras el usuario no esté autenticado
// contra Clerk en MS1, `usuarioId` es un ObjectId interno de la colección
// `usuarios` de MS1, no un userId de Clerk. Eso lo maneja el Gateway en las
// rutas que sí requieren identidad — ms2-scraping no lo necesita para
// scrapear.
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
