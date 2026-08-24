/* llama a /v1/airports */
/* devuelve un JSON de aeropuertos filtrados por el country
que devuelve geocoding */

import { API_NINJAS_BASE_URL, API_NINJAS_KEY } from '../config/apiNinjas.config.js';

async function obtenerAeropuertosPorPais(country) {
  const url = `${API_NINJAS_BASE_URL}/airports?country=${country}&has_iata=true&limit=100`;

  const respuesta = await fetch(url, {
    headers: { 'X-Api-Key': API_NINJAS_KEY },
  });

  if (!respuesta.ok) {
    throw new Error(`Error al consultar airports: ${respuesta.status}`);
  }

  const aeropuertos = await respuesta.json();

  return aeropuertos;
}

export { obtenerAeropuertosPorPais };