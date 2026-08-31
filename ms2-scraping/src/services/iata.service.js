import { obtenerCoordenadas } from './geocoding.service.js';
import { obtenerAeropuertosPorPais } from './airports.service.js';
import { encontrarMasCercano } from '../utils/haversine.util.js';
import { appError } from '../utils/appError.js';

// Resuelve el código IATA del aeropuerto más cercano a una ciudad.
// Extraído de viaje.service.js (antes duplicado ahí y en
// middlewares/codigoAeropuerto.middleware.js) para poder reusarlo también
// desde scrapingResult.service.js, que scrapea vuelos con código IATA pero
// hoteles/actividades con el nombre de ciudad tal cual — no son
// intercambiables.
export async function resolverIata(nombreCiudad) {
    const datosGeo = await obtenerCoordenadas(nombreCiudad);
    if (!datosGeo) {
        throw appError('AIRPORT_RESOLUTION_FAILED', `No se pudo geolocalizar "${nombreCiudad}"`);
    }

    const aeropuertos = await obtenerAeropuertosPorPais(datosGeo.country);
    if (!aeropuertos || aeropuertos.length === 0) {
        throw appError('AIRPORT_RESOLUTION_FAILED', `No se encontraron aeropuertos para el país de "${nombreCiudad}"`);
    }

    const masCercano = encontrarMasCercano(datosGeo.latitude, datosGeo.longitude, aeropuertos);
    if (!masCercano) {
        throw appError('AIRPORT_RESOLUTION_FAILED', `No se pudo determinar el aeropuerto más cercano a "${nombreCiudad}"`);
    }

    return masCercano.iata;
}
