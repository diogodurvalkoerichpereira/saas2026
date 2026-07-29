const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const path = require('node:path');
const { env } = require('./config/env');
const { errorHandler, notFound } = require('./middlewares/error-handler');
const healthRoutes = require('./modules/health/health.routes');
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/users.routes');
const clientRoutes = require('./modules/clients/clients.routes');
const catalogRoutes = require('./modules/catalog/catalog.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const workRoutes = require('./modules/work/work.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const salesRoutes = require('./modules/sales/sales.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/work', workRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/sales', salesRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
