import express from 'express';
import vuelosRoutes from './routes/vuelos.routes.js';

const app = express();

app.use(express.json());
app.use('/api', vuelosRoutes);

export default app;
