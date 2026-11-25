import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Course, Department, Student, StudentDetailResponse } from '../types';
import { AvatarImage } from '../components/ui/AvatarImage';
import { Skeleton } from '../components/ui/Skeleton';

const studentFormSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(3, 'Student ID is required')
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, hyphens, or underscores only'),
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  email: z.string().trim().email('Valid email address required'),
  phone: z.string().trim().min(7, 'Phone number required').max(25),
  gender: z.enum(['Female', 'Male', 'Non-binary', 'Prefer not to say']),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  departmentId: z.string().min(1, 'Select a department'),
  courseId: z.string().min(1, 'Select a course'),
  semester: z.coerce.number().int().min(1).max(12),
  enrollmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  address: z.string().trim().min(3, 'Address is required').max(200),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State is required').max(80),
  postalCode: z.string().trim().min(3, 'Postal code is required').max(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED']),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

export function StudentFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [existingPhoto, setExistingPhoto] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema) as never,
    defaultValues: {
      studentId: '',
      fullName: '',
      email: '',
      phone: '',
      gender: 'Female',
      dateOfBirth: '2005-01-15',
      departmentId: '',
      courseId: '',
      semester: 1,
      enrollmentDate: new Date().toISOString().slice(0, 10),
      address: '',
      city: '',
      state: '',
      postalCode: '',
      status: 'ACTIVE',
    },
  });

  const selectedDeptId = watch('departmentId');
  const selectedCourseId = watch('courseId');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [dRes, cRes] = await Promise.all([
          apiRequest<{ items: Department[] }>('/api/academic/departments'),
          apiRequest<{ items: Course[] }>('/api/academic/courses'),
        ]);
        if (!active) return;
        setDepartments(dRes.items);
        setCourses(cRes.items);

        if (isEdit && id) {
          const detail = await apiRequest<StudentDetailResponse>(`/api/students/${id}`);
          if (!active) return;
          const s = detail.student;
          setExistingPhoto(s.profilePhoto || '');
          reset({
            studentId: s.studentId,
            fullName: s.fullName,
            email: s.email,
            phone: s.phone,
            gender: s.gender,
            dateOfBirth: s.dateOfBirth,
            departmentId: s.departmentId,
            courseId: s.courseId,
            semester: s.semester,
            enrollmentDate: s.enrollmentDate,
            address: s.address,
            city: s.city,
            state: s.state,
            postalCode: s.postalCode,
            status: s.status,
          });
        } else if (dRes.items.length > 0) {
          const firstDept = dRes.items[0]._id;
          const firstCourse = cRes.items.find((c) => c.departmentId === firstDept);
          setValue('departmentId', firstDept);
          if (firstCourse) setValue('courseId', firstCourse._id);
        }
      } catch (err) {
        toast({ variant: 'error', title: 'Failed to load form data', description: (err as Error).message });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isEdit, reset, setValue, toast]);

  const deptCourses = courses.filter((c) => c.departmentId === selectedDeptId);
  const currentCourse = courses.find((c) => c._id === selectedCourseId);
  const maxSemesters = currentCourse?.totalSemesters || 8;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'error', title: 'File too large', description: 'Maximum photo size is 2 MB.' });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (values: StudentFormValues) => {
    try {
      let savedId = id;
      if (isEdit && id) {
        const res = await apiRequest<{ student: Student }>(`/api/students/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(values),
        });
        savedId = res.student._id;
      } else {
        const res = await apiRequest<{ student: Student }>('/api/students', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        savedId = res.student._id;
      }

      if (photoFile && savedId) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        await apiRequest(`/api/students/${savedId}/photo`, {
          method: 'POST',
          body: fd,
        });
      }

      toast({
        variant: 'success',
        title: isEdit ? 'Student profile updated' : 'Student enrolled successfully',
        description: `${values.fullName} (${values.studentId}) saved.`,
      });
      navigate(`/students/${savedId}`);
    } catch (err) {
      toast({ variant: 'error', title: 'Save failed', description: (err as Error).message });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {isEdit ? 'Edit Student Profile' : 'Enroll New Student'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            All fields are validated on both client and server before persisting to the registry.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Photo + Identity Section */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-200 dark:border-slate-800">
            <AvatarImage
              src={photoPreview || existingPhoto}
              name={watch('fullName') || 'Student'}
              size="xl"
            />
            <div>
              <h2 className="text-sm font-semibold">Profile Photograph</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Optional. Supports JPEG, PNG, or WebP up to 2 MB (validated by file signature).
              </p>
              <label className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{photoFile ? photoFile.name : 'Choose Image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div>
            <h2 className="font-display text-base font-semibold mb-4">Personal & Contact Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="f-studentId" className="block text-xs font-medium mb-1.5">
                  Student ID *
                </label>
                <input
                  id="f-studentId"
                  {...register('studentId')}
                  placeholder="STU-2026-015"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {errors.studentId && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.studentId.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="f-fullName" className="block text-xs font-medium mb-1.5">
                  Full Name *
                </label>
                <input
                  id="f-fullName"
                  {...register('fullName')}
                  placeholder="Elena Rostova"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {errors.fullName && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="f-email" className="block text-xs font-medium mb-1.5">
                  Email Address *
                </label>
                <input
                  id="f-email"
                  type="email"
                  {...register('email')}
                  placeholder="elena@acadex.edu"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {errors.email && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="f-phone" className="block text-xs font-medium mb-1.5">
                  Phone Number *
                </label>
                <input
                  id="f-phone"
                  {...register('phone')}
                  placeholder="+1 (415) 555-0192"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {errors.phone && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="f-gender" className="block text-xs font-medium mb-1.5">
                  Gender *
                </label>
                <select
                  id="f-gender"
                  {...register('gender')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label htmlFor="f-dob" className="block text-xs font-medium mb-1.5">
                  Date of Birth *
                </label>
                <input
                  id="f-dob"
                  type="date"
                  {...register('dateOfBirth')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
                {errors.dateOfBirth && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.dateOfBirth.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold mb-4">Academic Enrollment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="f-dept" className="block text-xs font-medium mb-1.5">
                  Department *
                </label>
                <select
                  id="f-dept"
                  {...register('departmentId', {
                    onChange: (e) => {
                      const nextDept = e.target.value;
                      const matching = courses.filter((c) => c.departmentId === nextDept);
                      setValue('courseId', matching[0]?._id || '');
                    },
                  })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {errors.departmentId && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.departmentId.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="f-course" className="block text-xs font-medium mb-1.5">
                  Course / Program *
                </label>
                <select
                  id="f-course"
                  {...register('courseId')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                >
                  <option value="">Select course</option>
                  {deptCourses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                {errors.courseId && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.courseId.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="f-semester" className="block text-xs font-medium mb-1.5">
                  Semester *
                </label>
                <select
                  id="f-semester"
                  {...register('semester')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                >
                  {Array.from({ length: maxSemesters }).map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Semester {idx + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="f-enrollment" className="block text-xs font-medium mb-1.5">
                  Enrollment Date *
                </label>
                <input
                  id="f-enrollment"
                  type="date"
                  {...register('enrollmentDate')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
                {errors.enrollmentDate && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.enrollmentDate.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="f-status" className="block text-xs font-medium mb-1.5">
                  Student Status *
                </label>
                <select
                  id="f-status"
                  {...register('status')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="GRADUATED">Graduated</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold mb-4">Residential Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="f-address" className="block text-xs font-medium mb-1.5">
                  Street Address *
                </label>
                <input
                  id="f-address"
                  {...register('address')}
                  placeholder="742 Evergreen Terrace"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
                {errors.address && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.address.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="f-city" className="block text-xs font-medium mb-1.5">
                  City *
                </label>
                <input
                  id="f-city"
                  {...register('city')}
                  placeholder="San Francisco"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
                {errors.city && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.city.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-state" className="block text-xs font-medium mb-1.5">
                    State *
                  </label>
                  <input
                    id="f-state"
                    {...register('state')}
                    placeholder="California"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                  {errors.state && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.state.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="f-postal" className="block text-xs font-medium mb-1.5">
                    Postal Code *
                  </label>
                  <input
                    id="f-postal"
                    {...register('postalCode')}
                    placeholder="94107"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                  {errors.postalCode && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.postalCode.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/students')}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Student'}
          </button>
        </div>
      </form>
    </div>
  );
}
