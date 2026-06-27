import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import VideoPage from "./pages/VideoPage";
import QuizPage from "./pages/QuizPage";
import ResultPage from "./pages/ResultPage";
import CertificatePage from "./pages/CertificatePage";
import MyResults from "./pages/MyResults";
import CourseDetails from "./pages/CourseDetails";

import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

import SuperAdminLayout from "./components/SuperAdminLayout";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import ManageAdmins from "./pages/ManageAdmins";
import ManageUsers from "./pages/ManageUsers";
import ManageDepartments from "./pages/ManageDepartments";
import SuperAdminAnalytics from "./pages/SuperAdminAnalytics";

import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAnalytics from "./pages/AdminAnalytics";

import DepartmentAdminLayout from "./components/DepartmentAdminLayout";
import DepartmentAdminDashboard from "./pages/DepartmentAdminDashboard";
import DepartmentAssignTraining from "./pages/DepartmentAssignTraining";
import DepartmentMembers from "./pages/DepartmentMembers";
import DepartmentVideoLibrary from "./pages/DepartmentVideoLibrary";
import DepartmentUploadVideo from "./pages/DepartmentUploadVideo";
import DepartmentCourses from "./pages/DepartmentCourses";
import DepartmentTrainingAnalytics from "./pages/DepartmentTrainingAnalytics";

import AddCourse from "./pages/AddCourse";
import AddVideo from "./pages/AddVideo";
import ManageVideos from "./pages/ManageVideos";
import AddQuestion from "./pages/AddQuestion";
import ManageQuestions from "./pages/ManageQuestions";
import AdminResults from "./pages/AdminResults";
import EditVideo from "./pages/EditVideo";
import EditQuestion from "./pages/EditQuestion";

import UserLayout from "./components/UserLayout";
import AssignedCourses from "./pages/AssignedCourses";
import Certificates from "./pages/Certificates";
import MyLearnings from "./pages/MyLearnings";
import Profile from "./pages/Profile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

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

          <Route path="my-learnings" element={<MyLearnings />} />
          <Route path="assigned-courses" element={<AssignedCourses />} />
          <Route path="my-results" element={<MyResults />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="profile" element={<Profile />} />

          <Route path="course/:id" element={<CourseDetails />} />
          <Route path="video/:id" element={<VideoPage />} />
          <Route path="quiz/:id" element={<QuizPage />} />
          <Route path="result/:id" element={<ResultPage />} />
          <Route path="certificate/:id" element={<CertificatePage />} />
        </Route>

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
          <Route path="courses" element={<DepartmentCourses />} />
          <Route path="add-course" element={<AddCourse />} />
          <Route path="videos" element={<ManageVideos />} />
          <Route path="add-video" element={<AddVideo />} />
          <Route path="questions" element={<ManageQuestions />} />
          <Route path="add-question" element={<AddQuestion />} />
          <Route path="results" element={<AdminResults />} />
          <Route path="edit-video/:id" element={<EditVideo />} />
          <Route path="questions/edit/:courseId/:questionId" element={<EditQuestion />} />

          <Route path="my-learnings" element={<MyLearnings />} />
          <Route path="assigned-courses" element={<AssignedCourses />} />
          <Route path="my-results" element={<MyResults />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="profile" element={<Profile />} />

          <Route path="course/:id" element={<CourseDetails />} />
          <Route path="video/:id" element={<VideoPage />} />
          <Route path="quiz/:id" element={<QuizPage />} />
          <Route path="result/:id" element={<ResultPage />} />
          <Route path="certificate/:id" element={<CertificatePage />} />
        </Route>

        <Route
          path="/department-admin"
          element={
            <RoleRoute allowedRoles={["departmentAdmin"]}>
              <DepartmentAdminLayout />
            </RoleRoute>
          }
        >
          <Route index element={<DepartmentAdminDashboard />} />
          <Route path="members" element={<DepartmentMembers />} />

          <Route path="courses" element={<DepartmentCourses />} />
          <Route path="courses/create" element={<AddCourse />} />

          <Route path="videos" element={<ManageVideos />} />
          <Route path="questions" element={<ManageQuestions />} />
          <Route path="questions/add/:courseId" element={<AddQuestion />} />
          <Route path="assignments" element={<DepartmentAssignTraining />} />
          <Route path="edit-video/:id" element={<EditVideo />} />

          <Route path="video-library" element={<DepartmentVideoLibrary />} />
          <Route path="video-library/upload" element={<DepartmentUploadVideo />} />

          <Route path="questions/edit/:courseId/:questionId" element={<EditQuestion />} />

          <Route path="my-learnings" element={<MyLearnings />} />
          <Route path="assigned-courses" element={<AssignedCourses />} />
          <Route path="my-results" element={<MyResults />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="profile" element={<Profile />} />
<Route path="analytics" element={<DepartmentTrainingAnalytics />} />
          <Route path="course/:id" element={<CourseDetails />} />
          <Route path="video/:id" element={<VideoPage />} />
          <Route path="quiz/:id" element={<QuizPage />} />
          <Route path="result/:id" element={<ResultPage />} />
          <Route path="certificate/:id" element={<CertificatePage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assigned-courses" element={<AssignedCourses />} />
          <Route path="/my-results" element={<MyResults />} />
          <Route path="/course/:id" element={<CourseDetails />} />
          <Route path="/my-learnings" element={<MyLearnings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="/quiz/:id" element={<QuizPage />} />
          <Route path="/result/:id" element={<ResultPage />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="/certificate/:id" element={<CertificatePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;