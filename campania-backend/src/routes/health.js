import { Router } from 'express';
const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'campania-backend', time: new Date().toISOString() });
});

export default router;
