import mongoose from 'mongoose';

const { Schema } = mongoose;

const propuestaSchema = new Schema({
    destino: { type: String, required: true },
    vuelo: { type: Schema.Types.Mixed, required: true },
    hospedaje: { type: Schema.Types.Mixed, required: true },
    actividades: { type: [Schema.Types.Mixed], default: [] },
    precioEstimado: { type: Number, required: true },
    moneda: { type: String, default: 'ARS' },
    resumen: String
}, { _id: false });

const travelPlanSchema = new Schema({
    // ID de Clerk (string, ej. "user_2NNi..."), no un ObjectId de Mongo —
    // lo inyecta el Gateway en el header x-user-id.
    userId: { type: String, required: true },
    // De dónde se tomaron los datos para armar el plan
    scrapingResultId: { type: Schema.Types.ObjectId, ref: 'ScrapingResult', required: true },
    userSelectionId: { type: Schema.Types.ObjectId, ref: 'UserSelection' },
    destinos: { type: [String], required: true },
    propuestas: {
        type: [propuestaSchema],
        validate: v => Array.isArray(v) && v.length === 3
    },
    geminiModel: String
}, { timestamps: true, collection: 'travelPlans' });

export default mongoose.models.TravelPlan || mongoose.model('TravelPlan', travelPlanSchema);
