import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { getAllowedOrigins } from './config/env';
import { errorHandler, sanitizeBodyAndQuery } from './middleware/auth';
import academicRoutes from './routes/academicRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import authRoutes from './routes/authRoutes';
import fileRoutes from './routes/fileRoutes';
import studentRoutes from './routes/studentRoutes';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const allowedOrigins = getAllowedOrigins();
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        // Allow Cloud Run / AI Studio preview host origins matching *.run.app when served over HTTPS
        try {
          const parsed = new URL(origin);
          if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.run.app')) {
            callback(null, true);
            return;
          }
        } catch {
          // ignore parse failure
        }
        callback(new Error('Origin not permitted by CORS policy'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizeBodyAndQuery);

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded. Please slow down.' },
  });
  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/academic', academicRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api', analyticsRoutes);

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use(errorHandler);
  return app;
}
