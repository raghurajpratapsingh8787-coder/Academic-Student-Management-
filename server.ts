import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app';
import { env } from './server/config/env';
import { initDatabase } from './server/db/store';

async function startServer() {
  await initDatabase();
  const app = createApp();

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.info(`[Acadex] Server listening on http://0.0.0.0:${env.port}`);
  });
}

startServer().catch((err) => {
  console.error('[Acadex] Fatal startup error:', err);
  process.exit(1);
});
