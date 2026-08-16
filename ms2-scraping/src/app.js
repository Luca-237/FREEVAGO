import express from 'express';
import vuelosRoutes from './routes/vuelos.routes.js';
import hotelesRoutes from './routes/hoteles.routes.js';

const app = express();

app.use(express.json());
app.use('/api', vuelosRoutes);
app.use('/api', hotelesRoutes);

export default app;
