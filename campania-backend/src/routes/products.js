import { Router } from 'express';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// liest campania-backend/src/data/products.json
const dataPath = path.join(__dirname, '..', 'data', 'products.json');

router.get('/products', async (req, res, next) => {
  try {
    const raw = await readFile(dataPath, 'utf8');
    const data = JSON.parse(raw);
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
