import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/health.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';

const app = express();
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.get('/', (req, res) => res.send('Campania API v1 · OK'));
app.use(express.static('public')); // <— statische Dateien aus /public
app.get('/', (req, res) => res.send('Campania API v1 · OK'));
app.use('/api', healthRoutes);
app.use('/api', productsRoutes);
app.use('/api', ordersRoutes); 

export default app;
