import mongoose from 'mongoose';

const { Schema } = mongoose;

// NOTA: este modelo es un espejo de LECTURA de la colección que arma ms2-scraping.
// ms3-armado no escribe acá, solo consulta por id. Si ms2 cambia el esquema,
// hay que actualizar esto en conjunto.

const vueloSchema = new Schema({
    destino: String,
    origin: String,
    destination: String,
    departDate: String,
    price: String,
    legs: [Schema.Types.Mixed],
    rawText: String
}, { _id: false });

const hotelSchema = new Schema({
    destino: String,
    name: String,
    price: String,
    rating: String,
    rawText: String
}, { _id: false });

const actividadSchema = new Schema({
    destino: String,
    nombre: String,
    descripcion: String,
    precio: String,
    categoria: String
}, { _id: false });

const scrapingResultSchema = new Schema({
    // Entre 1 y 3 destinos cotizados en la misma búsqueda
    destinos: {
        type: [String],
        required: true,
        validate: v => Array.isArray(v) && v.length >= 1 && v.length <= 3
    },
    vuelos: [vueloSchema],
    hoteles: [hotelSchema],
    actividades: [actividadSchema],
    // Referencia a las preferencias/selecciones que cargó el usuario para esta búsqueda
    userSelection: { type: Schema.Types.ObjectId, ref: 'UserSelection' }
}, { timestamps: true, collection: 'scrapingResults' });

export default mongoose.models.ScrapingResult || mongoose.model('ScrapingResult', scrapingResultSchema);
