import { Router } from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

// ===== Setup =====
const router = Router();
const orderBus = new EventEmitter();
orderBus.setMaxListeners(0);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const ordersPath = path.join(dataDir, 'orders.json');

// ===== Helpers =====
async function ensureStore() {
  await mkdir(dataDir, { recursive: true }).catch(() => {});
  try { await readFile(ordersPath, 'utf8'); } catch { await writeFile(ordersPath, '[]', 'utf8'); }
}

async function readOrders() {
  try {
    await ensureStore();
    const raw = await readFile(ordersPath, 'utf8');
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[orders] readOrders failed', e);
    return [];
  }
}

async function writeOrders(list) {
  try {
    await ensureStore();
    await writeFile(ordersPath, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('[orders] writeOrders failed', e);
    throw e;
  }
}

function newId() { return 'o_' + Math.random().toString(36).slice(2, 10); }

// ===== Routes =====
// GET /orders – Liste für Admin
router.get('/orders', async (req, res) => {
  try {
    // Optional: Token prüfen (im Projekt aktuell nur Durchleitung)
    // const { token } = req.query; // falls später benötigt

    const list = await readOrders();
    // neueste zuerst
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ ok: true, data: list });
  } catch (e) {
    console.error('[orders] GET /orders failed', e);
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// POST /orders – neue Bestellung anlegen
router.post('/orders', async (req, res) => {
  try {
    const p = req.body || {};

    if (!Array.isArray(p.items) || p.items.length === 0) {
      return res.status(400).json({ ok: false, error: 'EMPTY_ITEMS' });
    }

    const order = {
      id: newId(),
      createdAt: new Date().toISOString(),
      mode: p.mode || 'delivery',
      customer: {
        name: p.customer?.name || '',
        email: p.customer?.email || '',
        phone: p.customer?.phone || ''
      },
      address: p.address || {},
      note: p.note || '',
      items: p.items,
      totals: p.totals || {},
      status: 'new'
    };

    const list = await readOrders();
    list.push(order);
    await writeOrders(list);

    // 🔔 Live-Event für neue Bestellung
    orderBus.emit('new-order', order);

    console.log('🧾 Neue Bestellung:', order.id, 'Summe:', order.totals?.total, 'Pos:', order.items?.length);
    res.status(201).json({ ok: true, orderId: order.id, data: order });
  } catch (e) {
    console.error('[orders] POST /orders failed', e);
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// PATCH /orders/:id – Status aktualisieren
router.patch('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const list = await readOrders();
    const idx = list.findIndex(o => o.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

    if (status) list[idx].status = status;
    list[idx].updatedAt = new Date().toISOString();
    await writeOrders(list);

    // 🔔 Live-Event für Statuswechsel (separat vom Beep-Event)
    orderBus.emit('status-change', list[idx]);

    res.json({ ok: true, data: list[idx] });
  } catch (e) {
    console.error('[orders] PATCH /orders/:id failed', e);
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// SSE: /orders/stream – Live-Updates
router.get('/orders/stream', async (req, res) => {
  try {
    // const { token } = req.query; // optional

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Sofortige Begrüßung + Ready
    res.write('event: ready\n');
    res.write('data: "ok"\n\n');

    // Heartbeat alle 25s
    const hb = setInterval(() => {
      res.write('event: ping\n');
      res.write('data: "1"\n\n');
    }, 25000);

    const onNew = (order) => {
      res.write(`event: new-order\ndata: ${JSON.stringify(order)}\n\n`);
    };
    orderBus.on('new-order', onNew);

    const onStatus = (order) => {
      res.write(`event: status-change\ndata: ${JSON.stringify(order)}\n\n`);
    };
    orderBus.on('status-change', onStatus);

    req.on('close', () => {
      clearInterval(hb);
      orderBus.off('new-order', onNew);
      orderBus.off('status-change', onStatus);
      try { res.end(); } catch {}
    });
  } catch (e) {
    console.error('[orders] GET /orders/stream failed', e);
    // Bei Fehler Verbindung sauber schließen
    try { res.end(); } catch {}
  }
});

export default router;