import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

const Login = lazy(() => import("./pages/Login"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const VideoPage = lazy(() => import("./pages/VideoPage"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const ResultPage = lazy(() => import("./pages/ResultPage"));
const CertificatePage = lazy(() => import("./pages/CertificatePage"));
const MyResults = lazy(() => import("./pages/MyResults"));
const CourseDetails = lazy(() => import("./pages/CourseDetails"));
const CourseOverview = lazy(() => import("./pages/CourseOverview"));

import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

import SuperAdminLayout from "./components/SuperAdminLayout";
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const ManageAdmins = lazy(() => import("./pages/ManageAdmins"));
const ManageUsers = lazy(() => import("./pages/ManageUsers"));
const ManageDepartments = lazy(() => import("./pages/ManageDepartments"));
const SuperAdminAnalytics = lazy(() => import("./pages/SuperAdminAnalytics"));
const DepartmentAnalyticsPage = lazy(() => import("./pages/DepartmentAnalyticsPage"));

import AdminLayout from "./components/AdminLayout";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));

import DepartmentAdminLayout from "./components/DepartmentAdminLayout";
const DepartmentAdminDashboard = lazy(() => import("./pages/DepartmentAdminDashboard"));
const DepartmentAssignTraining = lazy(() => import("./pages/DepartmentAssignTraining"));
const DepartmentMembers = lazy(() => import("./pages/DepartmentMembers"));
const DepartmentVideoLibrary = lazy(() => import("./pages/DepartmentVideoLibrary"));
const DepartmentUploadVideo = lazy(() => import("./pages/DepartmentUploadVideo"));
const DepartmentCourses = lazy(() => import("./pages/DepartmentCourses"));
const DepartmentTestLogs = lazy(() => import("./pages/DepartmentTestLogs"));
const DepartmentTrainingAnalytics = lazy(() => import("./pages/DepartmentTrainingAnalytics"));
const DepartmentAnalytics = lazy(() => import("./pages/DepartmentAnalytics"));
const AssignedUsers = lazy(() => import("./pages/AssignedUsers"));

const AddCourse = lazy(() => import("./pages/AddCourse"));
const EditCourse = lazy(() => import("./pages/EditCourse"));

const ManageVideos = lazy(() => import("./pages/ManageVideos"));
const AddQuestion = lazy(() => import("./pages/AddQuestion"));
const ManageQuestions = lazy(() => import("./pages/ManageQuestions"));
const AdminResults = lazy(() => import("./pages/AdminResults"));
const EditVideo = lazy(() => import("./pages/EditVideo"));
const EditVideoLibrary = lazy(() => import("./pages/EditVideoLibrary"));
const EditQuestion = lazy(() => import("./pages/EditQuestion"));

import UserLayout from "./components/UserLayout";
const AssignedCourses = lazy(() => import("./pages/AssignedCourses"));
const Certificates = lazy(() => import("./pages/Certificates"));
const AllCertificates = lazy(() => import("./pages/AllCertificates"));
const MyLearnings = lazy(() => import("./pages/MyLearnings"));
const Profile = lazy(() => import("./pages/Profile"));
const Resources = lazy(() => import("./pages/Resources"));
const Notifications = lazy(() => import("./pages/Notifications"));

// The course overview shows quiz answers and is for staff only.
function CourseOverviewRedirect() {
  const { id } = useParams();
  return <Navigate to={`/course/${id}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading" role="status"><span className="page-loading-spinner" aria-hidden="true" /><span>Loading…</span></div>}>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* ================= SUPER ADMIN ROUTES ================= */}
        <Route
          path="/super-admin"
          element={
            <RoleRoute allowedRoles={["superAdmin"]}>
              <SuperAdminLayout />
            </RoleRoute>
          }
        >
          <Route index element={<SuperAdminDashboard />} />

          <Route path="admins" element={<ManageAdmins />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="departments" element={<ManageDepartments />} />

          <Route path="analytics" element={<SuperAdminAnalytics />} />

          <Route path="department-analytics" element={<DepartmentAnalyticsPage />} />

          <Route
            path="assignment-analytics"
            element={<DepartmentTrainingAnalytics />}
          />

          <Route path="courses" element={<DepartmentCourses />} />

          <Route path="courses/edit/:id" element={<EditCourse />} />

          <Route
            path="assignments"
            element={<DepartmentAssignTraining />}
          />

          <Route path="assigned-users" element={<AssignedUsers />} />

          <Route
            path="video-library"
            element={<DepartmentVideoLibrary />}
          />

          <Route
            path="video-library/edit/:id"
            element={<EditVideoLibrary />}
          />

          <Route path="results" element={<AdminResults />} />

          <Route path="my-learnings" element={<MyLearnings />} />

          <Route
            path="assigned-courses"
            element={<AssignedCourses />}
          />

          <Route path="my-results" element={<MyResults />} />
          <Route path="certificates" element={<Certificates />} />
          <Route
  path="all-certificates"
  element={<AllCertificates />}
/>

          <Route path="resources" element={<Resources />} />
          <Route path="profile" element={<Profile />} />

          <Route
            path="course/:id"
            element={<CourseDetails />}
          />

          <Route
            path="course-overview/:id"
            element={<CourseOverview />}
          />

          <Route
            path="course/:courseId/video/:videoId"
            element={<VideoPage />}
          />

          <Route
            path="quiz/:id"
            element={<QuizPage />}
          />

          <Route
            path="result/:id"
            element={<ResultPage />}
          />

          <Route
            path="certificate/:id"
            element={<CertificatePage />}
          />

          <Route
            path="notifications"
            element={<Notifications />}
          />
        </Route>

        {/* ================= ADMIN ROUTES ================= */}
        <Route
          path="/admin"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <AdminLayout />
            </RoleRoute>
          }
        >
          <Route index element={<AdminDashboard />} />

          <Route path="users" element={<ManageUsers />} />
          <Route path="departments" element={<ManageDepartments />} />

          <Route path="analytics" element={<AdminAnalytics />} />

          <Route path="department-analytics" element={<DepartmentAnalyticsPage />} />

          <Route
            path="assignment-analytics"
            element={<DepartmentTrainingAnalytics />}
          />

          <Route path="courses" element={<DepartmentCourses />} />

          <Route path="courses/edit/:id" element={<EditCourse />} />

          <Route
            path="assignments"
            element={<DepartmentAssignTraining />}
          />

          <Route path="assigned-users" element={<AssignedUsers />} />

          <Route
            path="video-library"
            element={<DepartmentVideoLibrary />}
          />

          <Route
            path="video-library/edit/:id"
            element={<EditVideoLibrary />}
          />

          <Route path="questions" element={<ManageQuestions />} />

          <Route
            path="add-question"
            element={<AddQuestion />}
          />

          <Route path="results" element={<AdminResults />} />

          <Route
            path="questions/edit/:courseId/:questionId"
            element={<EditQuestion />}
          />

          <Route path="my-learnings" element={<MyLearnings />} />

          <Route
            path="assigned-courses"
            element={<AssignedCourses />}
          />

          <Route path="my-results" element={<MyResults />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="all-certificates" element={<AllCertificates />} />
          <Route path="resources" element={<Resources />} />
          <Route path="profile" element={<Profile />} />

          <Route
            path="course/:id"
            element={<CourseDetails />}
          />

          <Route
            path="course-overview/:id"
            element={<CourseOverview />}
          />

          <Route
            path="course/:courseId/video/:videoId"
            element={<VideoPage />}
          />

          <Route
            path="quiz/:id"
            element={<QuizPage />}
          />

          <Route
            path="result/:id"
            element={<ResultPage />}
          />

          <Route
            path="certificate/:id"
            element={<CertificatePage />}
          />

          <Route
            path="notifications"
            element={<Notifications />}
          />
        </Route>

        {/* ================= DEPARTMENT ADMIN ROUTES ================= */}
        <Route
          path="/department-admin"
          element={
            <RoleRoute allowedRoles={["departmentAdmin"]}>
              <DepartmentAdminLayout />
            </RoleRoute>
          }
        >
          <Route index element={<DepartmentAdminDashboard />} />

          <Route
            path="members"
            element={<DepartmentMembers />}
          />

          <Route
            path="courses"
            element={<DepartmentCourses />}
          />

          <Route
            path="courses/create"
            element={<AddCourse />}
          />

          <Route
            path="courses/edit/:id"
            element={<EditCourse />}
          />

          <Route
            path="assignments"
            element={<DepartmentAssignTraining />}
          />

          <Route
            path="assigned-users"
            element={<AssignedUsers />}
          />

          <Route
            path="test-logs"
            element={<DepartmentTestLogs />}
          />

          <Route
            path="video-library"
            element={<DepartmentVideoLibrary />}
          />

          <Route
            path="video-library/upload"
            element={<DepartmentUploadVideo />}
          />

          <Route
            path="video-library/edit/:id"
            element={<EditVideoLibrary />}
          />

          <Route
            path="videos"
            element={<ManageVideos />}
          />

          <Route
            path="questions"
            element={<ManageQuestions />}
          />

          <Route
            path="questions/add/:courseId"
            element={<AddQuestion />}
          />

          <Route
            path="edit-video/:id"
            element={<EditVideo />}
          />

          <Route
            path="questions/edit/:courseId/:questionId"
            element={<EditQuestion />}
          />

          <Route
            path="my-learnings"
            element={<MyLearnings />}
          />

          <Route
            path="assigned-courses"
            element={<AssignedCourses />}
          />

          <Route path="my-results" element={<MyResults />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="all-certificates" element={<AllCertificates />} />
          <Route path="analytics" element={<DepartmentAnalytics />} />
          <Route path="resources" element={<Resources />} />
          <Route path="profile" element={<Profile />} />

          <Route
            path="course/:id"
            element={<CourseDetails />}
          />

          <Route
            path="course-overview/:id"
            element={<CourseOverview />}
          />

          <Route
            path="course/:courseId/video/:videoId"
            element={<VideoPage />}
          />

          <Route
            path="quiz/:id"
            element={<QuizPage />}
          />

          <Route
            path="result/:id"
            element={<ResultPage />}
          />

          <Route
            path="certificate/:id"
            element={<CertificatePage />}
          />

          <Route
            path="notifications"
            element={<Notifications />}
          />
        </Route>

        {/* ================= USER ROUTES ================= */}
        <Route
          element={
            <ProtectedRoute>
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/assigned-courses"
            element={<AssignedCourses />}
          />

          <Route
            path="/my-results"
            element={<MyResults />}
          />

          <Route
            path="/course/:id"
            element={<CourseDetails />}
          />

          <Route
            path="/course-overview/:id"
            element={<CourseOverviewRedirect />}
          />

          <Route
            path="/my-learnings"
            element={<MyLearnings />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/resources"
            element={<Resources />}
          />

          <Route
            path="/course/:courseId/video/:videoId"
            element={<VideoPage />}
          />

          <Route
            path="/quiz/:id"
            element={<QuizPage />}
          />

          <Route
            path="/result/:id"
            element={<ResultPage />}
          />

          <Route
            path="/certificates"
            element={<Certificates />}
          />

          <Route
            path="/certificate/:id"
            element={<CertificatePage />}
          />

          <Route
            path="/notifications"
            element={<Notifications />}
          />
        </Route>
      </Routes>
    </Suspense>
    </BrowserRouter>
  );
}

export default App;