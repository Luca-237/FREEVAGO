import mongoose from 'mongoose';

const { Schema } = mongoose;

// Espejo de LECTURA: ms2-scraping solo necesita validar que el
// userSelectionId que le mandan exista, para poder referenciarlo desde el
// ScrapingResult. La colección la llena otra parte del sistema.

const userSelectionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true },
    origenCiudad: { type: String, required: true },
    fechaIda: { type: String, required: true },
    fechaVuelta: String,
    cantidadPersonas: { type: Number, default: 1 },
    presupuesto: Number,
    preferencias: Schema.Types.Mixed
}, { timestamps: true, collection: 'userSelections' });

export default mongoose.models.UserSelection || mongoose.model('UserSelection', userSelectionSchema);
