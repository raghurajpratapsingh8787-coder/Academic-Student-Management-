import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Edit3, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Course, Department } from '../types';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableRowsSkeleton } from '../components/ui/Skeleton';

export function CoursesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterDeptId, setFilterDeptId] = useState('');
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [durationYears, setDurationYears] = useState(4);
  const [totalSemesters, setTotalSemesters] = useState(8);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [reassignToId, setReassignToId] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([
        apiRequest<{ items: Course[] }>('/api/academic/courses'),
        apiRequest<{ items: Department[] }>('/api/academic/departments'),
      ]);
      setCourses(cRes.items);
      setDepartments(dRes.items);
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to load courses', description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingCourse(null);
    setName('');
    setCode('');
    setDepartmentId(departments[0]?._id || '');
    setDurationYears(4);
    setTotalSemesters(8);
    setDescription('');
    setFormOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditingCourse(c);
    setName(c.name);
    setCode(c.code);
    setDepartmentId(c.departmentId);
    setDurationYears(c.durationYears);
    setTotalSemesters(c.totalSemesters);
    setDescription(c.description || '');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        code: code.toUpperCase(),
        departmentId,
        durationYears: Number(durationYears),
        totalSemesters: Number(totalSemesters),
        description,
      };
      if (editingCourse) {
        await apiRequest(`/api/academic/courses/${editingCourse._id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast({ variant: 'success', title: 'Course updated' });
      } else {
        await apiRequest('/api/academic/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast({ variant: 'success', title: 'Course created' });
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      toast({ variant: 'error', title: 'Save failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (c: Course) => {
    setDeleteTarget(c);
    const other = courses.find((x) => x._id !== c._id);
    setReassignToId(other?._id || '');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const hasStudents = (deleteTarget.studentCount || 0) > 0;
      const qs = hasStudents && reassignToId ? `?reassignToCourseId=${encodeURIComponent(reassignToId)}` : '';
      await apiRequest(`/api/academic/courses/${deleteTarget._id}${qs}`, { method: 'DELETE' });
      toast({ variant: 'success', title: 'Course deleted' });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast({ variant: 'error', title: 'Cannot delete course', description: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const visibleCourses = filterDeptId ? courses.filter((c) => c.departmentId === filterDeptId) : courses;
  const deleteHasStudents = Boolean(deleteTarget && (deleteTarget.studentCount || 0) > 0);
  const replacementCourses = courses.filter((c) => c._id !== deleteTarget?._id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Courses & Programs</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Configure academic degree tracks, duration, and semester structure per department.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={filterDeptId}
            onChange={(e) => setFilterDeptId(e.target.value)}
            aria-label="Filter courses by department"
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Course
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="px-4 py-3">Course Code</th>
                <th className="px-4 py-3">Course Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Semesters</th>
                <th className="px-4 py-3">Students</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-sm">
              {loading ? (
                <TableRowsSkeleton rows={5} cols={canManage ? 7 : 6} />
              ) : visibleCourses.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="px-6 py-12 text-center text-slate-500">
                    <BookOpen className="w-7 h-7 mx-auto mb-2 text-slate-400" />
                    No courses found.
                  </td>
                </tr>
              ) : (
                visibleCourses.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {c.code}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                      {c.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {c.departmentName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      {c.durationYears} yr{c.durationYears > 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">{c.totalSemesters}</td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">{c.studentCount || 0}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            aria-label={`Edit ${c.name}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDelete(c)}
                            aria-label={`Delete ${c.name}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Course Modal */}
      <AnimatePresence>
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFormOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold">
                  {editingCourse ? 'Edit Course' : 'New Course'}
                </h2>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  aria-label="Close modal"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="course-name" className="block text-xs font-medium mb-1.5">
                      Course Name *
                    </label>
                    <input
                      id="course-name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="B.S. Computer Science"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="course-code" className="block text-xs font-medium mb-1.5">
                      Code *
                    </label>
                    <input
                      id="course-code"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="BS-CS"
                      className="w-full px-3 py-2 text-sm font-mono uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="course-dept" className="block text-xs font-medium mb-1.5">
                    Department *
                  </label>
                  <select
                    id="course-dept"
                    required
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="course-dur" className="block text-xs font-medium mb-1.5">
                      Duration (Years) *
                    </label>
                    <input
                      id="course-dur"
                      type="number"
                      min={1}
                      max={8}
                      required
                      value={durationYears}
                      onChange={(e) => setDurationYears(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="course-sem" className="block text-xs font-medium mb-1.5">
                      Total Semesters *
                    </label>
                    <input
                      id="course-sem"
                      type="number"
                      min={1}
                      max={16}
                      required
                      value={totalSemesters}
                      onChange={(e) => setTotalSemesters(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="course-desc" className="block text-xs font-medium mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="course-desc"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Curriculum overview..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Course'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name}`}
        description={
          deleteHasStudents
            ? `${deleteTarget?.studentCount} student(s) are currently enrolled in this course. Select a replacement course to reassign them before deleting.`
            : 'Are you sure you want to delete this course?'
        }
        confirmLabel={deleteHasStudents ? 'Reassign & Delete' : 'Delete Course'}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        {deleteHasStudents && (
          <div>
            {replacementCourses.length === 0 ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Create another course first before deleting this one.
              </p>
            ) : (
              <div>
                <label htmlFor="reassign-course" className="block text-xs font-medium mb-1.5">
                  Reassign Enrolled Students To
                </label>
                <select
                  id="reassign-course"
                  value={reassignToId}
                  onChange={(e) => setReassignToId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {replacementCourses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
