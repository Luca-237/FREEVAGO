import express from 'express';
import { requestId } from './middlewares/requestId.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';
import vuelosRoutes from './routes/vuelos.routes.js';
import hotelesRoutes from './routes/hoteles.routes.js';
import scrapingResultsRoutes from './routes/scrapingResults.routes.js';

const app = express();

app.use(express.json());
app.use(requestId);

app.use('/api', vuelosRoutes);
app.use('/api', hotelesRoutes);
app.use('/api', scrapingResultsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
