// Chequeo aislado de Gemini: no toca Mongo ni el resto del pipeline, solo
// valida que GEMINI_API_KEY + GEMINI_MODEL (los del .env real) respondan.
// Uso: node scripts/check-gemini.js   (desde ms3-armado/, para que dotenv
// levante el .env local)
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

if (!apiKey) {
  console.error('❌ Falta GEMINI_API_KEY en ms3-armado/.env');
  process.exit(1);
}

console.log(`Probando modelo "${modelName}"...`);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });

try {
  const result = await model.generateContent('Respondé solo con la palabra "ok".');
  const text = result.response.text();
  console.log('Respuesta cruda:', JSON.stringify(text));
  console.log(`✅ Gemini responde con el modelo "${modelName}"`);
} catch (err) {
  console.error(`❌ Falló la llamada a Gemini con el modelo "${modelName}":`, err.message);
  process.exit(1);
}
