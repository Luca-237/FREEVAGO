import fetch from 'node-fetch';

/**
 * Traduce un destino (o ciudad) para obtener su código IATA y su nombre en inglés.
 * Utiliza la API pública de ubicaciones de Kiwi (Skypicker).
 * 
 * @param {string} query - El destino a buscar (ej. "Córdoba, Argentina")
 * @returns {Promise<{ iata: string, englishName: string }>} Objeto con los datos
 */
export async function getIataAndEnglishName(query) {
    try {
        const url = `https://api.skypicker.com/locations?term=${encodeURIComponent(query)}&locale=en-US`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error en la API de Kiwi: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data && data.locations && data.locations.length > 0) {
            // Buscamos preferentemente una 'city' o 'airport'
            const bestLocation = data.locations.find(loc => loc.type === 'city' || loc.type === 'airport') || data.locations[0];
            
            // `code` suele ser el código IATA
            const iata = bestLocation.code;
            
            // Tratamos de armar un buen nombre en inglés limpio. 
            // bestLocation.name está en el idioma solicitado (en-US)
            let englishName = bestLocation.name;
            if (bestLocation.country && bestLocation.country.name) {
                englishName = `${bestLocation.name}, ${bestLocation.country.name}`;
            }

            return {
                iata: iata,
                englishName: englishName
            };
        }
        
        throw new Error("No se encontraron resultados para el destino en Kiwi API.");
        
    } catch (error) {
        throw new Error(`Fallo al consultar Kiwi API: ${error.message}`);
    }
}
