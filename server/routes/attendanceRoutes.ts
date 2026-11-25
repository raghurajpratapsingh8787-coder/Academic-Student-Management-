import express from 'express';
import { db } from '../db/store';
import { authenticate } from '../middleware/auth';
import { computeAttendanceSummary } from '../utils/analyticsMath';
import { markAttendanceSchema } from '../validators/schemas';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const q = req.query;
    const scopedDeptId =
      req.user!.role === 'STAFF' && req.user!.departmentId
        ? req.user!.departmentId
        : typeof q.departmentId === 'string'
        ? q.departmentId
        : undefined;

    const records = await db.listAttendance({
      date: typeof q.date === 'string' ? q.date : undefined,
      month: typeof q.month === 'string' ? q.month : undefined,
      departmentId: scopedDeptId,
      courseId: typeof q.courseId === 'string' ? q.courseId : undefined,
      semester: q.semester ? Number(q.semester) : undefined,
      studentId: typeof q.studentId === 'string' ? q.studentId : undefined,
    });

    const [students, departments, courses] = await Promise.all([
      db.listAllStudents(),
      db.listDepartments(),
      db.listCourses(),
    ]);

    const studentMap = new Map(students.map((s) => [s._id, s]));
    const deptMap = new Map(departments.map((d) => [d._id, d]));
    const courseMap = new Map(courses.map((c) => [c._id, c]));

    const enriched = records.map((r) => {
      const st = studentMap.get(r.studentId);
      return {
        ...r,
        studentCode: st?.studentId || 'Unknown',
        studentName: st?.fullName || 'Removed Student',
        departmentName: deptMap.get(r.departmentId)?.name || 'Unassigned',
        courseName: courseMap.get(r.courseId)?.name || 'Unassigned',
      };
    });

    res.json({ items: enriched });
  } catch (err) {
    next(err);
  }
});

router.post('/mark', async (req, res, next) => {
  try {
    if (req.user!.role === 'STAFF') {
      const settings = await db.getSettings();
      if (!settings.allowStaffAttendanceEdit) {
        res.status(403).json({ error: 'Staff attendance editing is disabled by administrator settings' });
        return;
      }
    }

    const parsed = markAttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid attendance submission' });
      return;
    }

    if (req.user!.role === 'STAFF' && req.user!.departmentId) {
      const allStudents = await db.listAllStudents();
      const studentMap = new Map(allStudents.map((s) => [s._id, s]));
      for (const r of parsed.data.records) {
        const st = studentMap.get(r.studentId);
        if (!st || st.departmentId !== req.user!.departmentId) {
          res.status(403).json({ error: 'Staff can only mark attendance for their assigned department' });
          return;
        }
      }
    }

    const count = await db.upsertAttendanceBatch(parsed.data.date, req.user!.id, parsed.data.records);
    await db.logAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'ATTENDANCE_MARKED',
      entityType: 'Attendance',
      entityId: parsed.data.date,
      summary: `Recorded attendance for ${count} student(s) on ${parsed.data.date}`,
      ip: req.ip || '',
    });

    res.json({ ok: true, count, date: parsed.data.date });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const q = req.query;
    const scopedDeptId =
      req.user!.role === 'STAFF' && req.user!.departmentId
        ? req.user!.departmentId
        : typeof q.departmentId === 'string'
        ? q.departmentId
        : undefined;

    const [allStudents, attendance, departments, courses] = await Promise.all([
      db.listAllStudents(),
      db.listAttendance({
        month: typeof q.month === 'string' ? q.month : undefined,
        departmentId: scopedDeptId,
        courseId: typeof q.courseId === 'string' ? q.courseId : undefined,
        semester: q.semester ? Number(q.semester) : undefined,
      }),
      db.listDepartments(),
      db.listCourses(),
    ]);

    let students = allStudents;
    if (scopedDeptId) students = students.filter((s) => s.departmentId === scopedDeptId);
    if (typeof q.courseId === 'string' && q.courseId) {
      students = students.filter((s) => s.courseId === q.courseId);
    }
    if (q.semester) {
      const sem = Number(q.semester);
      students = students.filter((s) => s.semester === sem);
    }

    const summary = computeAttendanceSummary(students, attendance, departments, courses);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
