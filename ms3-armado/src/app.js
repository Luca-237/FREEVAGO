import express from 'express';
import { requestId } from './middlewares/requestId.middleware.js';
import { internalAuth } from './middlewares/internalAuth.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';
import healthRoutes from './routes/health.routes.js';
import travelPlansRoutes from './routes/travelPlans.routes.js';

const app = express();

app.use(express.json());
app.use(requestId);

// Sin prefijo /api: para que el Gateway y cualquier balanceador lo chequeen directo
app.use(healthRoutes);
app.use('/api', healthRoutes);

// A partir de acá, todo pasa por el chequeo de x-internal-key
app.use('/api', internalAuth, travelPlansRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
