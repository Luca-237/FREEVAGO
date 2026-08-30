import express from 'express';
import { requestId } from './middlewares/requestId.middleware.js';
import { requestLogger } from './middlewares/requestLogger.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';
import healthRoutes from './routes/health.routes.js';
import travelPlansRoutes from './routes/travelPlans.routes.js';

const app = express();

app.use(express.json());
app.use(requestId);
app.use(requestLogger);

// Sin prefijo /api: para que el Gateway y cualquier balanceador lo chequeen directo
app.use(healthRoutes);
app.use('/api', healthRoutes);

// El equipo decidió no usar x-internal-key: no hay chequeo de auth acá,
// solo la validación de x-user-id que hace el controller.
app.use('/api', travelPlansRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
