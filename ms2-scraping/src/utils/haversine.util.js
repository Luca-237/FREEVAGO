/* función pura: calcula distancia entre 2  */

/* Calcula la distancia en km entre dos puntos
gregraficos usando la formula de Haversine */

export function calcularDistancia(lat1, lng1, lat2, lng2) {
    const RADIO_TIERRA_KM = 6371;

    const dLat = gradosARadianes(lat2 - lat1);
    const dLng = gradosARadianes(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(gradosARadianes(lat1)) *
        Math.cos(gradosARadianes(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return RADIO_TIERRA_KM * c;
}

function gradosARadianes(grados) {
    return (grados * Math.PI) / 180;
}

/**
 * Recibe una lista de aeropuertos (con latitude/longitude)
 * y devuelve el más cercano a las coordenadas dadas.
 */

export function encontrarMasCercano(lat, lng, listaAeropuertos) {
    let masCercano = null;
    let menorDistancia = Infinity;

    for (const aeropuerto of listaAeropuertos) {
        const distancia = calcularDistancia(
            lat,
            lng,
            aeropuerto.latitude,
            aeropuerto.longitude
        );

        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            masCercano = aeropuerto;
        }
    }

    return masCercano;
}



/* probar con Node REPL
terminal: 
    > node
terminal: 
> const { calcularDistancia } = await import('./utils/haversine.util.js');
> console.log(calcularDistancia(-32.40, -63.23, -31.31, -64.21));
*/