import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// --- Layout & Route Components ---
import AppLayout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PublicRoute from './components/PublicRoute.jsx';
import AdminRoute from './components/AdminRoute.jsx';

// --- EXISTING PAGE COMPONENTS ---
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ResumeScannerPage from './pages/ResumeScannerPage.jsx';
import MockInterviewPage from './pages/MockInterviewPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import { ProfilePage, NotFoundPage } from './pages/OtherPages.jsx';
import { AboutUsPage, ContactPage, PrivacyPolicyPage } from './pages/StaticPages.jsx';
import PostJobPage from './pages/PostJobPage.jsx';
import ViewJobsPage from './pages/ViewJobsPage.jsx';
import JobDetailPage from './pages/JobDetailPage.jsx';
import EditJobPage from './pages/EditJobPage.jsx';
import ManageJobsPage from './pages/ManageJobsPage.jsx';
import ApplicantsPage from './pages/ApplicantsPage.jsx';
import CoursesPage from './pages/CoursesPage.jsx';
import CourseDetailPage from './pages/CourseDetailPage.jsx';
import CourseLessonPage from './pages/CourseLessonPage.jsx';
import MyCoursesPage from './pages/MyCoursesPage.jsx';
import MyApplicationsPage from './pages/MyApplicationsPage.jsx';
import CandidateSearchPage from './pages/CandidateSearchPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import AdminCoursesPage from './pages/AdminCoursesPage.jsx';
import CourseEditorPage from './pages/CourseEditorPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import AdminJobsPage from './pages/AdminJobsPage.jsx';
import CreateJobFairPage from './pages/CreateJobFairPage.jsx';
import ViewJobFairsPage from './pages/ViewJobFairsPage.jsx';
import JobFairDetailPage from './pages/JobFairDetailPage.jsx';
import ManageBoothPage from './pages/ManageBoothPage.jsx';
import MyRecruiterAppointments from './pages/MyRecruiterAppointments.jsx';
import MyStudentAppointments from './pages/MyStudentAppointments.jsx';
import ChatListPage from './pages/ChatListPage.jsx';
import ChatRoomPage from './pages/ChatRoomPage.jsx';
import CreateQnaPage from './pages/CreateQnaPage.jsx';
import QnaSessionPage from './pages/QnaSessionPage.jsx';
import StudentProfileViewPage from './pages/StudentProfileViewPage.jsx';
import CompanyProfilePage from './pages/CompanyProfilePage.jsx';

// --- NEW PAGE COMPONENTS ---
import ResourcesPage from './pages/ResourcesPage.jsx';
import ResourceDetailPage from './pages/ResourceDetailPage.jsx';
import AdminResourcesPage from './pages/AdminResourcesPage.jsx';
import AdminMLPage from './pages/AdminMLPage.jsx';
import AdminIntegrityPage from './pages/AdminIntegrityPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import MediaVerifyPage from './pages/MediaVerifyPage.jsx';
import SecurityPage from './pages/SecurityPage.jsx';
import ResumeBuilderPage from './pages/ResumeBuilderPage.jsx';
import ResourceEditorPage from './pages/ResourceEditorPage.jsx';
import CompaniesPage from './pages/CompaniesPage.jsx';
import CompanyDetailPage from './pages/CompanyDetailPage.jsx';
import AdminCompaniesPage from './pages/AdminCompaniesPage.jsx';
import CompanyEditorPage from './pages/CompanyEditorPage.jsx';


export default function App() {
    return (
        <BrowserRouter>
            <Toaster position="top-right" reverseOrder={false} />

            <Routes>
                {/* Public landing page: has its own navbar and footer */}
                <Route path="/" element={<LandingPage />} />

                {/* Auth routes without the main layout */}
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
                <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
                <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

                {/* All other routes use the main AppLayout */}
                <Route element={<AppLayout />}>
                    <Route path="/about" element={<AboutUsPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />

                    {/* Protected Routes */}
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                    {/* Job & Application Routes */}
                    <Route path="/post-job" element={<ProtectedRoute><PostJobPage /></ProtectedRoute>} />
                    <Route path="/edit-job/:jobId" element={<ProtectedRoute><EditJobPage /></ProtectedRoute>} />
                    <Route path="/jobs" element={<ProtectedRoute><ViewJobsPage /></ProtectedRoute>} />
                    <Route path="/jobs/:jobId" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
                    <Route path="/manage-jobs" element={<ProtectedRoute><ManageJobsPage /></ProtectedRoute>} />
                    <Route path="/jobs/:jobId/applicants" element={<ProtectedRoute><ApplicantsPage /></ProtectedRoute>} />
                    <Route path="/my-applications" element={<ProtectedRoute><MyApplicationsPage /></ProtectedRoute>} />
                    <Route path="/candidate-search" element={<ProtectedRoute><CandidateSearchPage /></ProtectedRoute>} />

                    {/* AI Tools */}
                    <Route path="/resume-scanner" element={<ProtectedRoute><ResumeScannerPage /></ProtectedRoute>} />
                    <Route path="/mock-interview" element={<ProtectedRoute><MockInterviewPage /></ProtectedRoute>} />
                    <Route path="/verify" element={<ProtectedRoute><MediaVerifyPage /></ProtectedRoute>} />
                    <Route path="/security" element={<ProtectedRoute><SecurityPage /></ProtectedRoute>} />
                    <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
                    <Route path="/resume-builder" element={<ProtectedRoute><ResumeBuilderPage /></ProtectedRoute>} />

                    {/* Course & Enrollment Routes */}
                    <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
                    <Route path="/courses/:courseId" element={<ProtectedRoute><CourseDetailPage /></ProtectedRoute>} />
                    <Route path="/courses/:courseId/lesson/:lessonId" element={<ProtectedRoute><CourseLessonPage /></ProtectedRoute>} />
                    <Route path="/my-courses" element={<ProtectedRoute><MyCoursesPage /></ProtectedRoute>} />

                    {/* Resource Library Routes */}
                    <Route path="/resources" element={<ProtectedRoute><ResourcesPage /></ProtectedRoute>} />
                    <Route path="/resources/:resourceId" element={<ProtectedRoute><ResourceDetailPage /></ProtectedRoute>} />

                    {/* Company Profile Routes */}
                    <Route path="/companies" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
                    <Route path="/companies/:companyId" element={<ProtectedRoute><CompanyDetailPage /></ProtectedRoute>} />

                    {/* Job Fair Routes */}
                    <Route path="/create-job-fair" element={<ProtectedRoute><CreateJobFairPage /></ProtectedRoute>} />
                    <Route path="/job-fairs" element={<ProtectedRoute><ViewJobFairsPage /></ProtectedRoute>} />
                    <Route path="/job-fair/:fairId" element={<ProtectedRoute><JobFairDetailPage /></ProtectedRoute>} />
                    <Route path="/manage-booth/:boothId" element={<ProtectedRoute><ManageBoothPage /></ProtectedRoute>} />
                    <Route path="/my-appointments" element={<ProtectedRoute><MyRecruiterAppointments /></ProtectedRoute>} />
                    <Route path="/my-scheduled-interviews" element={<ProtectedRoute><MyStudentAppointments /></ProtectedRoute>} />

                    {/* Admin Routes */}
                    <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
                    <Route path="/admin/integrity" element={<AdminRoute><AdminIntegrityPage /></AdminRoute>} />
                    <Route path="/admin/ml" element={<AdminRoute><AdminMLPage /></AdminRoute>} />
                    <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
                    <Route path="/admin/jobs" element={<AdminRoute><AdminJobsPage /></AdminRoute>} />
                    <Route path="/admin/courses" element={<AdminRoute><AdminCoursesPage /></AdminRoute>} />
                    <Route path="/admin/courses/new" element={<AdminRoute><CourseEditorPage /></AdminRoute>} />
                    <Route path="/admin/courses/edit/:courseId" element={<AdminRoute><CourseEditorPage /></AdminRoute>} />
                    <Route path="/admin/resources" element={<AdminRoute><AdminResourcesPage /></AdminRoute>} />
                    <Route path="/admin/resources/new" element={<AdminRoute><ResourceEditorPage /></AdminRoute>} />
                    <Route path="/admin/resources/edit/:resourceId" element={<AdminRoute><ResourceEditorPage /></AdminRoute>} />
                    <Route path="/admin/companies" element={<AdminRoute><AdminCompaniesPage /></AdminRoute>} />
                    <Route path="/admin/companies/new" element={<AdminRoute><CompanyEditorPage /></AdminRoute>} />
                    <Route path="/admin/companies/edit/:companyId" element={<AdminRoute><CompanyEditorPage /></AdminRoute>} />

                    {/* Other Routes */}
                    <Route path="/chat" element={<ProtectedRoute><ChatListPage /></ProtectedRoute>} />
                    <Route path="/chat/:chatId" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />
                    <Route path="/create-qna" element={<ProtectedRoute><CreateQnaPage /></ProtectedRoute>} />
                    <Route path="/qna-session/:sessionId" element={<ProtectedRoute><QnaSessionPage /></ProtectedRoute>} />
                    <Route path="/student/:studentId" element={<ProtectedRoute><StudentProfileViewPage /></ProtectedRoute>} />
                    <Route path="/company/:companyId" element={<ProtectedRoute><CompanyProfilePage /></ProtectedRoute>} />

                    {/* Catch-all 404 Route */}
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}