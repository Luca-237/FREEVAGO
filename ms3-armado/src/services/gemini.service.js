import { GoogleGenerativeAI } from '@google/generative-ai';
import { appError } from '../utils/appError.js';

// Schema de salida controlada: le pedimos a Gemini que devuelva EXACTAMENTE
// esta forma, así no dependemos de parsear texto libre.
const responseSchema = {
    type: 'object',
    properties: {
        propuestas: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    destino: { type: 'string' },
                    vuelo: {
                        type: 'object',
                        properties: {
                            aerolinea: { type: 'string' },
                            origen: { type: 'string' },
                            destino: { type: 'string' },
                            fechaIda: { type: 'string' },
                            fechaVuelta: { type: 'string' },
                            precio: { type: 'number' },
                            detalle: { type: 'string' },
                            // true si este vuelo sale de scraping.vuelos (dato real de MS2);
                            // false si no había ningún vuelo scrapeado para este destino y
                            // Gemini tuvo que estimarlo. Reemplaza al viejo "(Estimado)" suelto
                            // en el texto de aerolinea/detalle, que no era confiable para que
                            // el front lo detecte — ver promptBuilder.js para la instrucción.
                            esReal: { type: 'boolean' }
                        },
                        required: ['precio', 'esReal']
                    },
                    hospedaje: {
                        type: 'object',
                        properties: {
                            nombre: { type: 'string' },
                            precio: { type: 'number' },
                            puntuacion: { type: 'string' },
                            detalle: { type: 'string' }
                        },
                        required: ['precio']
                    },
                    actividades: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                nombre: { type: 'string' },
                                precio: { type: 'number' },
                                descripcion: { type: 'string' }
                            },
                            required: ['nombre']
                        }
                    },
                    precioEstimado: { type: 'number' },
                    moneda: { type: 'string' },
                    resumen: { type: 'string' }
                },
                required: ['destino', 'vuelo', 'hospedaje', 'actividades', 'precioEstimado']
            }
        }
    },
    required: ['propuestas']
};

let genAI;
function getClient() {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            throw appError('GEMINI_REQUEST_FAILED', 'Falta GEMINI_API_KEY en el .env de ms3-armado');
        }
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
}

export async function generarPropuestas(prompt) {
    const model = getClient().getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema
        }
    });

    let result;
    try {
        result = await model.generateContent(prompt);
    } catch (err) {
        throw appError('GEMINI_REQUEST_FAILED', `Falló la llamada a Gemini: ${err.message}`);
    }

    let parsed;
    try {
        parsed = JSON.parse(result.response.text());
    } catch {
        throw appError('GEMINI_INVALID_RESPONSE', 'Gemini no devolvió un JSON válido');
    }

    if (!Array.isArray(parsed.propuestas) || parsed.propuestas.length !== 3) {
        throw appError('GEMINI_INVALID_RESPONSE', 'Gemini no devolvió exactamente 3 propuestas', parsed);
    }

    return parsed.propuestas;
}
