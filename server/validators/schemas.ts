import { z } from 'zod';

const safeIdRegex = /^[a-zA-Z0-9_-]{2,40}$/;

export const setupAdminSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  seedSampleData: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16).max(200),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

export const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'STAFF']),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  departmentId: z.string().trim().optional().nullable(),
});

export const updateAdminSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().trim().optional().nullable(),
});

export const studentCreateSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(3, 'Student ID is required')
    .max(32)
    .regex(safeIdRegex, 'Use letters, numbers, hyphens, or underscores only'),
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  email: z.string().trim().email('Valid email required').toLowerCase(),
  phone: z.string().trim().min(7, 'Valid phone number required').max(25),
  gender: z.enum(['Female', 'Male', 'Non-binary', 'Prefer not to say']),
  dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  profilePhoto: z
    .string()
    .trim()
    .max(300)
    .refine(
      (val) => {
        if (!val) return true;
        if (val.includes('..') || val.includes('\\')) return false;
        if (val.startsWith('/api/files/avatars/') || val.startsWith('/src/assets/images/')) return true;
        try {
          const u = new URL(val);
          return u.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'Profile photo must be a safe uploaded avatar path or an HTTPS URL' }
    )
    .optional()
    .default(''),
  departmentId: z.string().trim().min(1, 'Department is required'),
  courseId: z.string().trim().min(1, 'Course is required'),
  semester: z.coerce.number().int().min(1).max(12),
  enrollmentDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  address: z.string().trim().min(3, 'Address is required').max(200),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State is required').max(80),
  postalCode: z.string().trim().min(3, 'Postal code is required').max(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED']).default('ACTIVE'),
});

export const studentUpdateSchema = studentCreateSchema.partial();

export const bulkStatusSchema = z.object({
  studentIds: z.array(z.string().trim().min(1)).min(1).max(200),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED']),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name is required').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Code is required')
    .max(16)
    .toUpperCase()
    .regex(/^[A-Z0-9-]+$/, 'Uppercase letters, numbers, and hyphens only'),
  description: z.string().trim().min(4).max(500),
  head: z.string().trim().min(2, 'Department head is required').max(100),
});

export const courseSchema = z.object({
  name: z.string().trim().min(2, 'Course name is required').max(120),
  code: z
    .string()
    .trim()
    .min(2, 'Course code is required')
    .max(20)
    .toUpperCase()
    .regex(/^[A-Z0-9-]+$/, 'Uppercase letters, numbers, and hyphens only'),
  departmentId: z.string().trim().min(1, 'Department is required'),
  durationYears: z.coerce.number().min(1).max(8),
  totalSemesters: z.coerce.number().int().min(1).max(16),
  description: z.string().trim().max(500).optional().default(''),
});

export const markAttendanceSchema = z.object({
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  records: z
    .array(
      z.object({
        studentId: z.string().trim().min(1),
        status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
        notes: z.string().trim().max(200).optional().default(''),
      })
    )
    .min(1)
    .max(500),
});

export const updateSettingsSchema = z.object({
  institutionName: z.string().trim().min(2).max(120),
  academicYear: z.string().trim().min(4).max(32),
  attendanceThreshold: z.coerce.number().min(50).max(100),
  allowStaffAttendanceEdit: z.boolean(),
});
