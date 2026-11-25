import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Edit3, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Department } from '../types';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Skeleton } from '../components/ui/Skeleton';

export function DepartmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [head, setHead] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [reassignToId, setReassignToId] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: Department[] }>('/api/academic/departments');
      setDepartments(res.items);
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to load departments', description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const openCreate = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setHead('');
    setDescription('');
    setFormOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setHead(dept.head);
    setDescription(dept.description);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, code: code.toUpperCase(), head, description };
      if (editingDept) {
        await apiRequest(`/api/academic/departments/${editingDept._id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast({ variant: 'success', title: 'Department updated' });
      } else {
        await apiRequest('/api/academic/departments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast({ variant: 'success', title: 'Department created' });
      }
      setFormOpen(false);
      await loadDepartments();
    } catch (err) {
      toast({ variant: 'error', title: 'Save failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (dept: Department) => {
    setDeleteTarget(dept);
    const other = departments.find((d) => d._id !== dept._id);
    setReassignToId(other?._id || '');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const hasDeps = (deleteTarget.studentCount || 0) > 0 || (deleteTarget.courseCount || 0) > 0;
      const qs = hasDeps && reassignToId ? `?reassignToDepartmentId=${encodeURIComponent(reassignToId)}` : '';
      await apiRequest(`/api/academic/departments/${deleteTarget._id}${qs}`, { method: 'DELETE' });
      toast({ variant: 'success', title: 'Department deleted' });
      setDeleteTarget(null);
      await loadDepartments();
    } catch (err) {
      toast({ variant: 'error', title: 'Cannot delete department', description: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const deleteHasDeps = Boolean(
    deleteTarget && ((deleteTarget.studentCount || 0) > 0 || (deleteTarget.courseCount || 0) > 0)
  );
  const otherDepartments = departments.filter((d) => d._id !== deleteTarget?._id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage academic faculties, department heads, and safe reassignment policies.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="mt-3 font-medium">No departments configured</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create your first academic department to organize courses and student enrollments.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
            >
              Add First Department
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map((dept) => (
            <div
              key={dept._id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
                      {dept.code}
                    </p>
                    <h2 className="font-display text-lg font-semibold mt-0.5">{dept.name}</h2>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(dept)}
                        aria-label={`Edit ${dept.name}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(dept)}
                        aria-label={`Delete ${dept.name}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {dept.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Head: <strong className="text-slate-800 dark:text-slate-200 font-medium">{dept.head}</strong></span>
                <span className="tabular-nums">
                  {dept.courseCount || 0} courses · {dept.studentCount || 0} students
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
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
                  {editingDept ? 'Edit Department' : 'New Department'}
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
                    <label htmlFor="dept-name" className="block text-xs font-medium mb-1.5">
                      Department Name *
                    </label>
                    <input
                      id="dept-name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Computer Science & Engineering"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="dept-code" className="block text-xs font-medium mb-1.5">
                      Code *
                    </label>
                    <input
                      id="dept-code"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="CSE"
                      className="w-full px-3 py-2 text-sm font-mono uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dept-head" className="block text-xs font-medium mb-1.5">
                    Department Head *
                  </label>
                  <input
                    id="dept-head"
                    required
                    value={head}
                    onChange={(e) => setHead(e.target.value)}
                    placeholder="Dr. Helena Vance"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="dept-desc" className="block text-xs font-medium mb-1.5">
                    Description *
                  </label>
                  <textarea
                    id="dept-desc"
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Faculty focus, degrees offered, and academic scope..."
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
                    {saving ? 'Saving...' : 'Save Department'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Safe Delete / Reassignment Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name}`}
        description={
          deleteHasDeps
            ? `This department currently has ${deleteTarget?.studentCount || 0} student(s) and ${deleteTarget?.courseCount || 0} course(s). Select another department to reassign them before deleting.`
            : 'Are you sure you want to delete this department? This action is recorded in the audit log.'
        }
        confirmLabel={deleteHasDeps ? 'Reassign & Delete' : 'Delete Department'}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        {deleteHasDeps && (
          <div>
            {otherDepartments.length === 0 ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Create another department first before deleting this one.
              </p>
            ) : (
              <div>
                <label htmlFor="reassign-dept" className="block text-xs font-medium mb-1.5">
                  Reassign Students & Courses To
                </label>
                <select
                  id="reassign-dept"
                  value={reassignToId}
                  onChange={(e) => setReassignToId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {otherDepartments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
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
