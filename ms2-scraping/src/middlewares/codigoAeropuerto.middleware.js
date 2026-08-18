import { obtenerCoordenadas } from '../services/geocoding.service.js';
import { obtenerAeropuertosPorPais } from '../services/airports.service.js';
import { encontrarMasCercano } from '../utils/haversine.util.js';

/* orquestador. con las cooredenadas y el pais de la ciudad
ingresada, se busca el aeropuerto mas cercano a esa ciudad */

async function codigoAeropuerto(req, res, next) {
  try {
    const ciudadOrigen = req.body.origin;

    if (!ciudadOrigen) {
      return res.status(400).json({ error: 'Falta el parámetro origin' });
    }

    // 1. Ciudad → coordenadas + país
    const datosGeo = await obtenerCoordenadas(ciudadOrigen);

    if (!datosGeo) {
      return res.status(400).json({ error: 'Ciudad no encontrada' });
    }

    // 2. Traer aeropuertos de ese país
    const aeropuertos = await obtenerAeropuertosPorPais(datosGeo.country);

    if (!aeropuertos || aeropuertos.length === 0) {
      return res.status(400).json({ error: 'No se encontraron aeropuertos para ese país' });
    }

    // 3. Encontrar el más cercano
    const aeropuertoCercano = encontrarMasCercano(
      datosGeo.latitude,
      datosGeo.longitude,
      aeropuertos
    );

    // 4. Dejarlo listo para el siguiente paso (controller/scraper)
    req.body.originCode = aeropuertoCercano.iata;

    next();
  } catch (error) {
    console.error('Error en middleware codigoAeropuerto:', error.message);
    res.status(500).json({ error: 'Error al resolver el aeropuerto de origen' });
  }
}

export { codigoAeropuerto };


/* probar:
await import('dotenv/config');
const { codigoAeropuerto } = await import('./src/middlewares/codigoAeropuerto.middleware.js');

const req = { body: { origin: 'Rio Cuarto' } };
const res = {
  status(code) { console.log('status:', code); return this; },
  json(payload) { console.log('json:', payload); }
};
const next = () => console.log('next() llamado, req.body:', req.body);

await codigoAeropuerto(req, res, next);

*/