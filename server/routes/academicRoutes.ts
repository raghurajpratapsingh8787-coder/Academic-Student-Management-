import express from 'express';
import { db } from '../db/store';
import { authenticate, requireRole } from '../middleware/auth';
import { courseSchema, departmentSchema } from '../validators/schemas';

const router = express.Router();

router.use(authenticate);

// ---------------- DEPARTMENTS ----------------
router.get('/departments', async (_req, res, next) => {
  try {
    const [departments, courses, students] = await Promise.all([
      db.listDepartments(),
      db.listCourses(),
      db.listAllStudents(),
    ]);
    const items = departments.map((dept) => ({
      ...dept,
      courseCount: courses.filter((c) => c.departmentId === dept._id).length,
      studentCount: students.filter((s) => s.departmentId === dept._id).length,
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/departments', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const parsed = departmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid department data' });
      return;
    }
    const created = await db.createDepartment(parsed.data);
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DEPARTMENT_CREATED',
      entityType: 'Department',
      entityId: created._id,
      summary: `Created department ${created.name} (${created.code})`,
      ip: req.ip || '',
    });
    res.status(201).json({ department: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/departments/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const parsed = departmentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid department update' });
      return;
    }
    const updated = await db.updateDepartment(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'Department',
      entityId: updated._id,
      summary: `Updated department ${updated.name} (${updated.code})`,
      ip: req.ip || '',
    });
    res.json({ department: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/departments/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const reassignTo =
      typeof req.query.reassignToDepartmentId === 'string' ? req.query.reassignToDepartmentId : undefined;
    await db.deleteDepartment(req.params.id, reassignTo);
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'DEPARTMENT_DELETED',
      entityType: 'Department',
      entityId: req.params.id,
      summary: reassignTo
        ? `Deleted department ${req.params.id} and reassigned dependencies to ${reassignTo}`
        : `Deleted department ${req.params.id}`,
      ip: req.ip || '',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------- COURSES ----------------
router.get('/courses', async (req, res, next) => {
  try {
    const deptId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
    const [courses, departments, students] = await Promise.all([
      db.listCourses(deptId),
      db.listDepartments(),
      db.listAllStudents(),
    ]);
    const deptMap = new Map(departments.map((d) => [d._id, d]));
    const items = courses.map((c) => ({
      ...c,
      departmentName: deptMap.get(c.departmentId)?.name || 'Unassigned',
      departmentCode: deptMap.get(c.departmentId)?.code || 'N/A',
      studentCount: students.filter((s) => s.courseId === c._id).length,
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/courses', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const parsed = courseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid course data' });
      return;
    }
    const created = await db.createCourse(parsed.data);
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'COURSE_CREATED',
      entityType: 'Course',
      entityId: created._id,
      summary: `Created course ${created.name} (${created.code})`,
      ip: req.ip || '',
    });
    res.status(201).json({ course: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/courses/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const parsed = courseSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid course update' });
      return;
    }
    const updated = await db.updateCourse(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'COURSE_UPDATED',
      entityType: 'Course',
      entityId: updated._id,
      summary: `Updated course ${updated.name} (${updated.code})`,
      ip: req.ip || '',
    });
    res.json({ course: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/courses/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const reassignTo =
      typeof req.query.reassignToCourseId === 'string' ? req.query.reassignToCourseId : undefined;
    await db.deleteCourse(req.params.id, reassignTo);
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'COURSE_DELETED',
      entityType: 'Course',
      entityId: req.params.id,
      summary: reassignTo
        ? `Deleted course ${req.params.id} and reassigned students to ${reassignTo}`
        : `Deleted course ${req.params.id}`,
      ip: req.ip || '',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
