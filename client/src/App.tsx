import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ToastProvider } from './components/common/ToastProvider';
import { RequireAnonymous, RequireAuth, RequireRole } from './features/auth/RouteGuards';
import { LoadingBlock, EmptyState } from './components/common';
import { Link } from 'react-router-dom';

// Public
import LandingPage from './pages/public/LandingPage';
import AboutPage from './pages/public/AboutPage';
import AssessmentsInfoPage from './pages/public/AssessmentsInfoPage';
import BenefitsPage from './pages/public/BenefitsPage';
import PrivacyPage from './pages/public/PrivacyPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import ResetPasswordPage from './pages/public/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

// Candidate
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const AssessmentsPage = lazy(() => import('./pages/student/Assessments'));
const InstructionsPage = lazy(() => import('./pages/student/Instructions'));
const AttemptPage = lazy(() => import('./pages/student/Attempt'));
const ResultPage = lazy(() => import('./pages/student/Result'));
const HistoryPage = lazy(() => import('./pages/student/History'));
const ReportsPage = lazy(() => import('./pages/student/Reports'));
const ReportDetailPage = lazy(() => import('./pages/student/ReportDetail'));
const RoadmapsPage = lazy(() => import('./pages/student/Roadmaps'));
const RoadmapDetailPage = lazy(() => import('./pages/student/RoadmapDetail'));
const ProfilePage = lazy(() => import('./pages/student/Profile'));
const CareersPage = lazy(() => import('./pages/shared/CareersCatalogue'));
const CompatibilityPage = lazy(() => import('./pages/shared/Compatibility'));

// Counsellor
const CounsellorDashboard = lazy(() => import('./pages/counsellor/Dashboard'));
const StudentsPage = lazy(() => import('./pages/counsellor/Students'));
const StudentDetailPage = lazy(() => import('./pages/counsellor/StudentDetail'));
const QuestionsPage = lazy(() => import('./pages/admin/Questions'));
const AssessmentsAdminPage = lazy(() => import('./pages/admin/Assessments'));
const BatchAnalyticsPage = lazy(() => import('./pages/counsellor/BatchAnalytics'));

// Management
const ManagementDashboard = lazy(() => import('./pages/management/Dashboard'));
const ManagementAnalyticsPage = lazy(() => import('./pages/management/Analytics'));
const ManagementExportsPage = lazy(() => import('./pages/management/Exports'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const UsersPage = lazy(() => import('./pages/admin/Users'));
const CareersAdminPage = lazy(() => import('./pages/admin/Careers'));
const SkillsPage = lazy(() => import('./pages/admin/Skills'));
const CategoriesPage = lazy(() => import('./pages/admin/Categories'));
const SettingsPage = lazy(() => import('./pages/admin/Settings'));
const AuditPage = lazy(() => import('./pages/admin/Audit'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/Analytics'));

function PageFallback() {
  return (
    <div className="py-10">
      <LoadingBlock label="Loading page" />
    </div>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* ---------------- Public ---------------- */}
            <Route
              path="/"
              element={
                <RequireAnonymous>
                  <LandingPage />
                </RequireAnonymous>
              }
            />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/assessments-info" element={<AssessmentsInfoPage />} />
            <Route path="/benefits" element={<BenefitsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route
              path="/login"
              element={
                <RequireAnonymous>
                  <LoginPage />
                </RequireAnonymous>
              }
            />
            <Route
              path="/register"
              element={
                <RequireAnonymous>
                  <RegisterPage />
                </RequireAnonymous>
              }
            />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* ---------------- Candidate ---------------- */}
            <Route
              path="/dashboard"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <StudentDashboard />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/assessments"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <AssessmentsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/assessments/:id/instructions"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <InstructionsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/assessments/attempt/:attemptId"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <AttemptPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/assessments/result/:attemptId"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <ResultPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/history"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <HistoryPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <ReportsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/reports/:reportNumber"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <ReportDetailPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/roadmaps"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <RoadmapsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/roadmaps/:id"
              element={
                <RequireRole roles={['student']}>
                  <Lazy>
                    <RoadmapDetailPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireRole roles={['student', 'counsellor', 'management', 'admin']}>
                  <Lazy>
                    <ProfilePage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/compatibility"
              element={
                <RequireRole roles={['student', 'counsellor']}>
                  <Lazy>
                    <CompatibilityPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/careers"
              element={
                <RequireRole roles={['student', 'counsellor', 'management', 'admin']}>
                  <Lazy>
                    <CareersPage />
                  </Lazy>
                </RequireRole>
              }
            />

            {/* ---------------- Counsellor ---------------- */}
            <Route
              path="/counsellor"
              element={
                <RequireRole roles={['counsellor']}>
                  <Lazy>
                    <CounsellorDashboard />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/counsellor/students"
              element={
                <RequireRole roles={['counsellor']}>
                  <Lazy>
                    <StudentsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/counsellor/students/:id"
              element={
                <RequireRole roles={['counsellor']}>
                  <Lazy>
                    <StudentDetailPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/counsellor/questions"
              element={
                <RequireRole roles={['counsellor']}>
                  <Lazy>
                    <QuestionsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/counsellor/assessments"
              element={
                <RequireRole roles={['counsellor']}>
                  <Lazy>
                    <AssessmentsAdminPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/counsellor/analytics"
              element={
                <RequireRole roles={['counsellor']}>
                  <Lazy>
                    <BatchAnalyticsPage />
                  </Lazy>
                </RequireRole>
              }
            />

            {/* ---------------- Management ---------------- */}
            <Route
              path="/management"
              element={
                <RequireRole roles={['management']}>
                  <Lazy>
                    <ManagementDashboard />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/management/analytics"
              element={
                <RequireRole roles={['management']}>
                  <Lazy>
                    <ManagementAnalyticsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/management/reports"
              element={
                <RequireRole roles={['management']}>
                  <Lazy>
                    <ManagementExportsPage />
                  </Lazy>
                </RequireRole>
              }
            />

            {/* ---------------- Administrator ---------------- */}
            <Route
              path="/admin"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <AdminDashboard />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <UsersPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/questions"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <QuestionsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/assessments"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <AssessmentsAdminPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/careers"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <CareersAdminPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/skills"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <SkillsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <CategoriesPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <SettingsPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <AuditPage />
                  </Lazy>
                </RequireRole>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireRole roles={['admin']}>
                  <Lazy>
                    <AdminAnalyticsPage />
                  </Lazy>
                </RequireRole>
              }
            />

            {/* ---------------- Fallbacks ---------------- */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route
              path="*"
              element={
                <NotFoundPage>
                  <EmptyState
                    title="Page not found"
                    description="The page you requested does not exist or has moved."
                    action={
                      <Link to="/" className="btn btn-primary">
                        Back to home
                      </Link>
                    }
                  />
                </NotFoundPage>
              }
            />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
