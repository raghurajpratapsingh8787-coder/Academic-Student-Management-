import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AttendancePage } from './pages/AttendancePage';
import { AuthPage } from './pages/AuthPage';
import { CoursesPage } from './pages/CoursesPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StudentFormPage } from './pages/StudentFormPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { StudentsPage } from './pages/StudentsPage';

function ProtectedShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const canManage = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route
          path="/students/new"
          element={canManage ? <StudentFormPage /> : <Navigate to="/students" replace />}
        />
        <Route path="/students/:id" element={<StudentProfilePage />} />
        <Route
          path="/students/:id/edit"
          element={canManage ? <StudentFormPage /> : <Navigate to="/students" replace />}
        />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <ProtectedShell />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
