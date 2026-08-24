import mongoose from 'mongoose';

const { Schema } = mongoose;

// NOTA: igual que ScrapingResult, es un espejo de LECTURA. La colección la
// llena el flujo de selección del usuario (frontend / ms1 / lo que corresponda),
// ms3-armado solo la lee para armar el prompt de Gemini.

const userSelectionSchema = new Schema({
    // ID de Clerk (string), no un ObjectId de Mongo.
    userId: { type: String, required: true },
    origenCiudad: { type: String, required: true },
    fechaIda: { type: String, required: true },
    fechaVuelta: String,
    cantidadPersonas: { type: Number, default: 1 },
    presupuesto: Number,
    // Cualquier otra preferencia libre (tipo de viaje, intereses, etc.)
    preferencias: Schema.Types.Mixed
}, { timestamps: true, collection: 'userSelections' });

export default mongoose.models.UserSelection || mongoose.model('UserSelection', userSelectionSchema);
