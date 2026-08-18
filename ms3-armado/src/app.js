import express from 'express';
import { requestId } from './middlewares/requestId.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';
import travelPlansRoutes from './routes/travelPlans.routes.js';

const app = express();

app.use(express.json());
app.use(requestId);

app.use('/api', travelPlansRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
