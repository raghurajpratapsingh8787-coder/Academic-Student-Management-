import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserCircle,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiRequest } from '../services/api';
import type { NotificationItem } from '../types';
import { formatRelativeTime } from '../utils/pureFormatters';
import { AvatarImage } from '../components/ui/AvatarImage';
import { WORKSPACE_OWNER } from '../config/owner';

const ROUTE_LABELS: Record<string, string> = {
  '': 'Overview',
  students: 'Students',
  new: 'Add Student',
  edit: 'Edit Profile',
  departments: 'Departments',
  courses: 'Courses',
  attendance: 'Attendance',
  reports: 'Reports',
  settings: 'Settings',
  profile: 'Profile',
};

export function DashboardLayout() {
  const { user, settings, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      const res = await apiRequest<{ items: NotificationItem[]; unreadCount: number }>('/api/notifications');
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [location.pathname]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalSearch.trim();
    navigate(q ? `/students?search=${encodeURIComponent(q)}` : '/students');
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const canManageStudents = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/students', label: 'Students', icon: Users, end: true },
    ...(canManageStudents ? [{ to: '/students/new', label: 'Add Student', icon: UserPlus, end: true }] : []),
    { to: '/departments', label: 'Departments', icon: Building2, end: true },
    { to: '/courses', label: 'Courses', icon: BookOpen, end: true },
    { to: '/attendance', label: 'Attendance', icon: CalendarCheck2, end: true },
    { to: '/reports', label: 'Reports', icon: BarChart3, end: true },
    { to: '/settings', label: 'Settings', icon: Settings, end: true },
    { to: '/profile', label: 'Profile', icon: UserCircle, end: true },
  ];

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs =
    pathSegments.length === 0
      ? [{ label: 'Overview', to: '/' }]
      : pathSegments.map((seg, idx) => {
          const to = '/' + pathSegments.slice(0, idx + 1).join('/');
          const label = ROUTE_LABELS[seg] || (seg.length > 16 ? 'Student Profile' : seg);
          return { label, to };
        });

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const SidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F1624] border-r border-slate-200 dark:border-slate-800/90">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/90 shrink-0">
        <Link to="/" className="flex items-center gap-2.5 text-slate-900 dark:text-white min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-display text-[13px] font-bold tracking-tight leading-tight">
            Academic &amp; Student Management
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav aria-label="Primary Navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800/90 space-y-2 shrink-0">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
            {settings?.institutionName || 'Academic & Student Management'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            Term {settings?.academicYear || '2026-2027'}
          </p>
          <div className="pt-2 mt-2 border-t border-slate-200/70 dark:border-slate-800/80">
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
              {WORKSPACE_OWNER.name}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {WORKSPACE_OWNER.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-62 shrink-0 sticky top-0 h-screen no-print">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex no-print">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 bg-slate-950/60"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 w-64 h-full"
            >
              {SidebarContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#0F1624]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
              <Link
                to="/"
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap truncate max-w-[220px]"
              >
                Academic &amp; Student Management
              </Link>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={b.to}>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <Link
                    to={b.to}
                    className={`truncate ${
                      i === breadcrumbs.length - 1
                        ? 'font-semibold text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {b.label}
                  </Link>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <form onSubmit={handleGlobalSearchSubmit} className="hidden md:flex items-center relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search students..."
                aria-label="Global student search"
                className="w-52 lg:w-64 pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </form>

            <span className="hidden xl:inline-block text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap px-2">
              {todayFormatted}
            </span>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Dropdown */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={notifOpen}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-40"
                  >
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-sm font-semibold">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n._id}
                            type="button"
                            onClick={() => handleMarkOneRead(n._id)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                              !n.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {n.title}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                                {formatRelativeTime(n.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                              {n.message}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <AvatarImage src={user?.avatarUrl} name={user?.name || 'Admin'} size="sm" />
                <div className="hidden sm:block text-left max-w-[130px]">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {user?.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user?.role.replace('_', ' ')}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1.5 z-40"
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold truncate">{user?.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <UserCircle className="w-4 h-4" />
                      My Profile
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
