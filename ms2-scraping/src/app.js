import express from 'express';
import { requestId } from './middlewares/requestId.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';
import healthRoutes from './routes/health.routes.js';
import vuelosRoutes from './routes/vuelos.routes.js';
import hotelesRoutes from './routes/hoteles.routes.js';
import actividadesRoutes from './routes/actividades.routes.js';
import sugerenciasRoutes from './routes/sugerencias.routes.js';
import viajeRoutes from './routes/viaje.routes.js';
import scrapingResultsRoutes from './routes/scrapingResults.routes.js';

const app = express();

app.use(express.json());
app.use(requestId);

// Sin prefijo /api: para que el Gateway y cualquier balanceador lo chequeen directo
app.use(healthRoutes);

app.use('/api', healthRoutes);
app.use('/api', vuelosRoutes);
app.use('/api', hotelesRoutes);
app.use('/api', actividadesRoutes);
app.use('/api', sugerenciasRoutes);
app.use('/api', viajeRoutes);
app.use('/api', scrapingResultsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
