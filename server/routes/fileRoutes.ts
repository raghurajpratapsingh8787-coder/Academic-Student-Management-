import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { db } from '../db/store';
import { authenticate } from '../middleware/auth';
import { detectImageSignature, resolveSafeFilePath } from '../utils/crypto';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.post('/admin-avatar', authenticate, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Image file is required' });
      return;
    }
    const sig = detectImageSignature(req.file.buffer);
    if (!sig) {
      res.status(400).json({ error: 'Unsupported or invalid image format. Allowed: JPEG, PNG, WebP.' });
      return;
    }
    if (!fs.existsSync(env.uploadDir)) {
      fs.mkdirSync(env.uploadDir, { recursive: true });
    }
    const filename = `adm_${crypto.randomUUID()}${sig.ext}`;
    const targetPath = path.resolve(env.uploadDir, filename);
    fs.writeFileSync(targetPath, req.file.buffer);

    const avatarUrl = `/api/files/avatars/${filename}`;
    await db.updateAdmin(req.user!.id, { avatarUrl });
    res.json({ avatarUrl });
  } catch (err) {
    next(err);
  }
});

router.get('/avatars/:filename', authenticate, (req, res) => {
  const safePath = resolveSafeFilePath(env.uploadDir, req.params.filename);
  if (!safePath || !fs.existsSync(safePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(safePath);
});

export default router;
