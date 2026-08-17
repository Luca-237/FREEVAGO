import mongoose from 'mongoose';

const { Schema } = mongoose;

// ms2-scraping es el dueño de esta colección (acá se escribe). ms3-armado
// tiene un espejo de LECTURA con el mismo esquema — si se cambia acá,
// hay que actualizar ms3-armado/src/models/ScrapingResult.model.js también.

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
    // Todavía no hay scraper de actividades: queda vacío hasta que se agregue
    actividades: [actividadSchema],
    // Referencia a las preferencias/selecciones que cargó el usuario para esta búsqueda
    userSelection: { type: Schema.Types.ObjectId, ref: 'UserSelection', required: true }
}, { timestamps: true, collection: 'scrapingResults' });

export default mongoose.models.ScrapingResult || mongoose.model('ScrapingResult', scrapingResultSchema);
