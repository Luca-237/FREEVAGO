// Arma el prompt que se le manda a Gemini, con el bulk scrapeado (vuelos,
// hoteles, actividades) + las preferencias del usuario, y la regla de cómo
// repartir las 3 propuestas según la cantidad de destinos cotizados:
//  - 1 destino  -> 3 variantes del mismo destino
//  - 2 destinos -> 3 propuestas repartidas de forma versátil entre ambos
//  - 3 destinos -> 1 propuesta por destino
export function buildPrompt({ destinos, userSelection, scraping }) {
    return `
Sos un asistente experto en armado de viajes para la app FREEVAGO. Con los datos scrapeados y las preferencias del usuario de abajo, armá EXACTAMENTE 3 propuestas de viaje completas (un vuelo + un hospedaje + una lista de actividades cada una).

${buildReglaDistribucion(destinos)}

Reglas generales:
- Cada propuesta elige UN vuelo, UN hospedaje y una lista de actividades, tomados de los datos scrapeados de abajo. Si para algún destino faltan datos, completá con una estimación razonable y aclaralo en "resumen".
- "precioEstimado" es la suma aproximada de vuelo + hospedaje + actividades, en la misma moneda ("moneda").
- Priorizá, entre las opciones disponibles, las que mejor se ajusten a las preferencias del usuario (presupuesto, cantidad de personas, tipo de viaje, fechas).
- Devolvé SOLO el JSON pedido, sin texto adicional ni markdown.

Preferencias del usuario:
${JSON.stringify(userSelection ?? {}, null, 2)}

Datos scrapeados (vuelos, hoteles, actividades por destino):
${JSON.stringify(scraping, null, 2)}
`.trim();
}

function buildReglaDistribucion(destinos) {
    if (destinos.length === 1) {
        return `El usuario cotizó un solo destino (${destinos[0]}). Las 3 propuestas deben ser 3 variantes distintas para ese mismo destino (por ejemplo variando el vuelo, el hospedaje o el mix de actividades).`;
    }
    if (destinos.length === 3) {
        return `El usuario cotizó 3 destinos (${destinos.join(', ')}). Generá exactamente 1 propuesta por destino: una para cada uno de los 3.`;
    }
    return `El usuario cotizó 2 destinos (${destinos.join(', ')}). Repartí las 3 propuestas de forma versátil entre ambos según cuál tenga mejores/más datos disponibles (por ejemplo 2 propuestas para el destino con mejores opciones y 1 para el otro) — no tiene que ser necesariamente parejo.`;
}
