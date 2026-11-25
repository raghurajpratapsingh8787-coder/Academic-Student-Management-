import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { db } from '../db/store';
import { authenticate, requireRole } from '../middleware/auth';
import { detectImageSignature } from '../utils/crypto';
import { bulkStatusSchema, studentCreateSchema, studentUpdateSchema } from '../validators/schemas';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const q = req.query;
    const scopedDepartmentId =
      req.user!.role === 'STAFF' && req.user!.departmentId
        ? req.user!.departmentId
        : typeof q.departmentId === 'string'
        ? q.departmentId
        : undefined;

    const result = await db.listStudents({
      search: typeof q.search === 'string' ? q.search : undefined,
      departmentId: scopedDepartmentId,
      courseId: typeof q.courseId === 'string' ? q.courseId : undefined,
      status: typeof q.status === 'string' ? q.status : undefined,
      semester: q.semester ? Number(q.semester) : undefined,
      dateFrom: typeof q.dateFrom === 'string' ? q.dateFrom : undefined,
      dateTo: typeof q.dateTo === 'string' ? q.dateTo : undefined,
      sortBy: typeof q.sortBy === 'string' ? q.sortBy : undefined,
      sortOrder: q.sortOrder === 'asc' ? 'asc' : 'desc',
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 10,
    });

    const [departments, courses] = await Promise.all([db.listDepartments(), db.listCourses()]);
    const deptMap = new Map(departments.map((d) => [d._id, d]));
    const courseMap = new Map(courses.map((c) => [c._id, c]));

    const enriched = result.items.map((s) => ({
      ...s,
      departmentName: deptMap.get(s.departmentId)?.name || 'Unassigned',
      departmentCode: deptMap.get(s.departmentId)?.code || 'N/A',
      courseName: courseMap.get(s.courseId)?.name || 'Unassigned',
      courseCode: courseMap.get(s.courseId)?.code || 'N/A',
    }));

    res.json({ ...result, items: enriched });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const parsed = studentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid student data' });
      return;
    }

    const created = await db.createStudent(parsed.data);
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'STUDENT_CREATED',
      entityType: 'Student',
      entityId: created._id,
      summary: `Enrolled ${created.fullName} (${created.studentId})`,
      ip: req.ip || '',
    });

    await db.createNotification({
      title: 'New Student Enrolled',
      message: `${created.fullName} (${created.studentId}) was added to the student directory.`,
      type: 'INFO',
      createdBy: req.user!.id,
    });

    res.status(201).json({ student: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/bulk-status', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const parsed = bulkStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid bulk update payload' });
      return;
    }
    const updatedCount = await db.bulkUpdateStudentStatus(parsed.data.studentIds, parsed.data.status);
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'STUDENT_BULK_STATUS',
      entityType: 'Student',
      entityId: parsed.data.studentIds.join(','),
      summary: `Updated status to ${parsed.data.status} for ${updatedCount} student(s)`,
      ip: req.ip || '',
    });
    res.json({ updatedCount });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const student = await db.findStudentById(req.params.id);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    if (req.user!.role === 'STAFF' && req.user!.departmentId && student.departmentId !== req.user!.departmentId) {
      res.status(403).json({ error: 'You do not have permission to view this student record' });
      return;
    }

    const [dept, course, attendance, auditLogs] = await Promise.all([
      db.findDepartmentById(student.departmentId),
      db.findCourseById(student.courseId),
      db.listAttendance({ studentId: student._id }),
      db.listAuditLogs({ entityId: student._id, limit: 25 }),
    ]);

    const totalDays = attendance.length;
    const presentCount = attendance.filter((a) => a.status === 'PRESENT').length;
    const lateCount = attendance.filter((a) => a.status === 'LATE').length;
    const absentCount = attendance.filter((a) => a.status === 'ABSENT').length;
    const attendanceRate = totalDays > 0 ? Math.round(((presentCount + lateCount * 0.5) / totalDays) * 100) : null;

    res.json({
      student: {
        ...student,
        departmentName: dept?.name || 'Unassigned',
        departmentCode: dept?.code || 'N/A',
        courseName: course?.name || 'Unassigned',
        courseCode: course?.code || 'N/A',
      },
      attendanceSummary: {
        totalDays,
        presentCount,
        lateCount,
        absentCount,
        attendanceRate,
        recentRecords: attendance.slice(0, 20),
      },
      activityHistory: auditLogs,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const parsed = studentUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid student update data' });
      return;
    }

    const updated = await db.updateStudent(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'STUDENT_UPDATED',
      entityType: 'Student',
      entityId: updated._id,
      summary: `Updated profile for ${updated.fullName} (${updated.studentId})`,
      ip: req.ip || '',
    });

    res.json({ student: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/photo', requireRole('SUPER_ADMIN', 'ADMIN'), upload.single('photo'), async (req, res, next) => {
  try {
    const student = await db.findStudentById(req.params.id);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
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
    const filename = `stu_${crypto.randomUUID()}${sig.ext}`;
    const targetPath = path.resolve(env.uploadDir, filename);
    fs.writeFileSync(targetPath, req.file.buffer);

    const photoUrl = `/api/files/avatars/${filename}`;
    const updated = await db.updateStudent(student._id, { profilePhoto: photoUrl });

    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'STUDENT_PHOTO_UPDATED',
      entityType: 'Student',
      entityId: student._id,
      summary: `Updated profile photo for ${student.fullName}`,
      ip: req.ip || '',
    });

    res.json({ student: updated, profilePhoto: photoUrl });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const removed = await db.deleteStudent(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'STUDENT_DELETED',
      entityType: 'Student',
      entityId: removed._id,
      summary: `Removed student ${removed.fullName} (${removed.studentId})`,
      ip: req.ip || '',
    });

    res.json({ ok: true, deletedId: removed._id });
  } catch (err) {
    next(err);
  }
});

export default router;
