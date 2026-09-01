import mongoose from 'mongoose';
import ScrapingResult from '../models/ScrapingResult.model.js';
import ConversacionViaje from '../models/ConversacionViaje.model.js';
import { performScrape as performScrapeVuelos } from '../scrapers/vuelos.scraper.js';
import { performScrape as performScrapeHoteles } from '../scrapers/hoteles.scraper.js';
import { performScrapeAuto as performScrapeActividades } from '../scrapers/actividades.scraper.js';
import { resolverIata } from './iata.service.js';
import { appError } from '../utils/appError.js';

// Toma los destinos ya elegidos (override explícito del caller) o los
// deriva de viaje.destino.lugaresPreferidos. Si el usuario dejó el destino
// abierto (destinosAbiertos: true) y no eligió ningún lugar preferido,
// no hay forma de que ms2-scraping invente uno: eso todavía es una decisión
// de producto sin cerrar entre equipos (¿lo resuelve MS1 con otra pasada de
// IA sugiriendo destinos, el front, o un paso nuevo?) — por ahora avisamos
// con un error claro en vez de fallar en silencio o inventar un destino.
function resolverDestinos(viaje, destinosOverride) {
    if (Array.isArray(destinosOverride) && destinosOverride.length > 0) {
        return destinosOverride;
    }

    const preferidos = viaje?.destino?.lugaresPreferidos || [];
    const ciudades = [...new Set(preferidos.map(l => l.ciudad).filter(Boolean))].slice(0, 3);

    if (ciudades.length > 0) {
        return ciudades;
    }

    throw appError(
        'VALIDATION_ERROR',
        viaje?.destino?.destinosAbiertos
            ? 'El usuario dejó el destino abierto (destinosAbiertos: true) y no hay lugaresPreferidos en la conversación: no hay destino que scrapear. Mandá "destinos" explícito en el body mientras no se resuelva quién elige el destino en ese caso.'
            : 'La conversación no tiene destino: revisá viaje.destino.lugaresPreferidos, o mandá "destinos" explícito en el body.'
    );
}

// Corre el scraper de vuelos, hoteles y actividades para cada destino, arma
// UN ScrapingResult con todo junto y lo guarda. Si algún destino falla en
// alguna fuente (sitio caído, sin resultados, etc.) no aborta todo el
// pedido: lo registra en "warnings" y sigue con el resto. Solo falla si al
// final no quedó ningún vuelo ni hotel utilizable (actividades es opcional).
//
// El input de esta función ya no lo arma el caller a mano (origen,
// fechaIda, etc. sueltos): se lee todo de la conversación real que guardó
// MS1, identificada por conversacionId. Esto es lo que antes leía de un
// UserSelection que nadie llenaba nunca.
export async function generarYGuardarScraping({ conversacionId, destinos: destinosOverride, pasajeros: pasajerosOverride }) {
    if (!mongoose.isValidObjectId(conversacionId)) {
        throw appError('VALIDATION_ERROR', 'conversacionId inválido');
    }

    const conversacion = await ConversacionViaje.findById(conversacionId).lean();
    if (!conversacion) {
        throw appError('CONVERSACION_NOT_FOUND', 'No existe la conversación referenciada');
    }
    if (conversacion.estado !== 'completo') {
        throw appError('CONVERSACION_INCOMPLETA', 'La conversación todavía no llegó a "listoParaBuscar" del lado de MS1 (estado != completo)');
    }

    const viaje = conversacion.viaje || {};
    const origenCiudad = viaje.lugarSalida?.ciudad;
    if (!origenCiudad) {
        throw appError('VALIDATION_ERROR', 'La conversación no tiene lugarSalida.ciudad cargado');
    }
    const fechaIda = viaje.fechaSalida;
    if (!fechaIda) {
        throw appError('VALIDATION_ERROR', 'La conversación no tiene fechaSalida cargada');
    }
    const fechaVuelta = viaje.fechaFin || '';
    const pax = pasajerosOverride || viaje.viajeros?.cantidadTotal || 1;

    const destinos = resolverDestinos(viaje, destinosOverride);

    // Ciudad -> país, para poder desambiguar en resolverIata (ver comentario
    // en geocoding.service.js: nombres de ciudad como "Córdoba" matchean
    // varios países). Si el destino vino de destinosOverride (body explícito,
    // sin objeto {ciudad,pais}) no hay país conocido y resolverIata cae al
    // comportamiento viejo (primer resultado de geocoding).
    const paisPorDestino = new Map(
        (viaje.destino?.lugaresPreferidos || [])
            .filter(l => l.ciudad && l.pais)
            .map(l => [l.ciudad, l.pais])
    );

    const origenIata = await resolverIata(origenCiudad, viaje.lugarSalida?.pais);

    const vuelos = [];
    const hoteles = [];
    const actividades = [];
    const warnings = [];

    for (const destino of destinos) {
        const log = (msg) => console.log(`[scraping-results:${destino}] ${msg}`);

        let destinoIata;
        try {
            destinoIata = await resolverIata(destino, paisPorDestino.get(destino));
        } catch (err) {
            warnings.push({ destino, tipo: 'vuelos', error: `No se pudo resolver el aeropuerto de destino: ${err.message}` });
        }

        if (destinoIata) {
            const vueloResult = await performScrapeVuelos(origenIata, destinoIata, fechaIda, fechaVuelta, pax, log);
            if (vueloResult.error) {
                warnings.push({ destino, tipo: 'vuelos', error: vueloResult.error });
            } else {
                for (const f of vueloResult.flights) {
                    vuelos.push({
                        destino,
                        origin: vueloResult.origin,
                        destination: vueloResult.destination,
                        departDate: vueloResult.departDate,
                        price: f.price,
                        legs: f.legs,
                        rawText: f.rawText
                    });
                }
            }
        }

        // Hoteles y actividades buscan por nombre de ciudad, no por IATA
        // (a diferencia de vuelos) — antes se reusaba el mismo string para
        // los tres y rompía a uno de los dos según qué forma tuviera.
        const hotelResult = await performScrapeHoteles(destino, fechaIda, fechaVuelta || null, pax, log);
        if (hotelResult.error) {
            warnings.push({ destino, tipo: 'hoteles', error: hotelResult.error });
        } else {
            for (const h of hotelResult.hotels) {
                hoteles.push({
                    destino,
                    name: h.name,
                    price: h.price,
                    rating: h.rating,
                    rawText: h.rawText
                });
            }
        }

        const actividadResult = await performScrapeActividades(destino, log);
        if (actividadResult.error) {
            warnings.push({ destino, tipo: 'actividades', error: actividadResult.error });
        } else {
            for (const a of actividadResult.activities) {
                actividades.push({
                    destino,
                    nombre: a.titulo,
                    descripcion: a.descripcionBreve,
                    precio: a.precioPorPersona,
                    categoria: a.origen
                });
            }
        }
    }

    if (vuelos.length === 0 && hoteles.length === 0) {
        throw appError('SCRAPING_FAILED', 'No se pudo obtener ningún resultado (vuelos ni hoteles) para los destinos pedidos', warnings);
    }

    try {
        const scrapingResult = await ScrapingResult.create({
            destinos,
            vuelos,
            hoteles,
            actividades,
            conversacionViajeId: conversacionId
        });
        return { scrapingResult, warnings };
    } catch (err) {
        throw appError('DB_SAVE_ERROR', `No se pudo guardar el ScrapingResult: ${err.message}`);
    }
}
