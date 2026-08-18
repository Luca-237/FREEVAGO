/**
 * Traduce un destino (o ciudad) para obtener su código IATA y su nombre.
 * Utiliza la API de Turismocity mediante Puppeteer para evitar bloqueos y timeouts.
 * 
 * @param {string} query - El destino a buscar (ej. "Córdoba, Argentina")
 * @param {object} page - Instancia de Puppeteer Page
 * @returns {Promise<{ iata: string, englishName: string }>} Objeto con los datos
 */
export async function getIataAndEnglishName(query, page) {
    try {
        if (!page) {
            throw new Error("Se requiere una instancia de Puppeteer Page para consultar Turismocity.");
        }
        const data = await page.evaluate(async (q) => {
            const res = await fetch('https://api.turismocity.com/flights/fullLocation/AR?&departure=NONE&query=' + encodeURIComponent(q));
            return await res.json();
        }, query);
        
        if (data && data.length > 0) {
            // Buscamos preferentemente un 'City' o 'Airport'
            const bestLocation = data.find(loc => loc.type === 'City' || loc.type === 'Airport') || data[0];
            
            const iata = bestLocation.iata || bestLocation.slug;
            let englishName = bestLocation.name;
            if (bestLocation.city && bestLocation.country) {
                englishName = `${bestLocation.city}, ${bestLocation.country}`;
            }

            return {
                iata: iata,
                englishName: englishName
            };
        }
        
        throw new Error("No se encontraron resultados para el destino.");
        
    } catch (error) {
        throw new Error(`Fallo al consultar la API de ubicaciones: ${error.message}`);
    }
}
