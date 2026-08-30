import { Router } from 'express';

const router = Router();

// GET /health y GET /api/health (se monta en ambas rutas desde app.js).
// Sin auth: el Gateway y cualquier balanceador lo necesitan accesible directo.
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ms3-armado' });
});

export default router;
