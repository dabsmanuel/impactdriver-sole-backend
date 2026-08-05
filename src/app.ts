import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import engineRoutes from './routes/engines';
import reportRoutes from './routes/reports';
import adminRoutes from './routes/admin';
import regulatoryDefinitionsRoutes from './routes/regulatoryDefinitions'; // GAP 6d
import engineSnapshotRoutes from './routes/engineSnapshots';               // GAP 7d

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/engines', engineRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/regulatory-definitions', regulatoryDefinitionsRoutes); // GAP 6d
app.use('/api/engine-snapshots', engineSnapshotRoutes);               // GAP 7d

app.use(errorHandler);

export default app;
