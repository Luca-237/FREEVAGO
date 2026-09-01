/* llama a /v1/geocoding */
/* devuelve lat/lng/country de una ciudad */

import { API_NINJAS_BASE_URL, API_NINJAS_KEY } from '../config/apiNinjas.config.js';

async function obtenerCoordenadas(ciudad, pais) {
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

  // Un mismo nombre de ciudad puede matchear varias del mundo (ej. "Córdoba"
  // devuelve España, Argentina, México y Colombia) y la API no las ordena
  // por relevancia para nuestro caso — sin desambiguar, España le gana a
  // Argentina por venir primero en la respuesta. Si nos pasaron el país
  // esperado, preferimos ese match; si no hay ninguno que coincida (o no
  // nos pasaron país), caemos al primer resultado como antes.
  let elegido = datos[0];
  if (pais) {
    const match = datos.find(
      (d) => d.country_name?.toLowerCase() === pais.toLowerCase()
    );
    if (match) elegido = match;
  }

  const { latitude, longitude, country } = elegido;

  return { latitude, longitude, country };
}

export { obtenerCoordenadas };

/* await import('dotenv/config');
const { obtenerCoordenadas } = await import('./src/services/geocoding.service.js');
console.log(await obtenerCoordenadas('Rio Cuarto'));
 */