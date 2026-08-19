/* llama a /v1/geocoding */
/* devuelve lat/lng/country de una ciudad */

import { API_NINJAS_BASE_URL, API_NINJAS_KEY } from '../config/apiNinjas.config.js';

async function obtenerCoordenadas(ciudad) {
  const url = `${API_NINJAS_BASE_URL}/geocoding?city=${encodeURIComponent(ciudad)}`;

  const respuesta = await fetch(url, {
    headers: { 'X-Api-Key': API_NINJAS_KEY },
  });

  if (!respuesta.ok) {
    throw new Error(`Error al consultar geocoding: ${respuesta.status}`);
  }

  const datos = await respuesta.json();

  if (!datos || datos.length === 0) {
    return null;
  }

  const { latitude, longitude, country } = datos[0];

  return { latitude, longitude, country };
}

export { obtenerCoordenadas };

/* await import('dotenv/config');
const { obtenerCoordenadas } = await import('./src/services/geocoding.service.js');
console.log(await obtenerCoordenadas('Rio Cuarto'));
 */