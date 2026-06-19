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

import AddCourse from "./pages/AddCourse";
import ManageCourses from "./pages/ManageCourses";
import AddVideo from "./pages/AddVideo";
import ManageVideos from "./pages/ManageVideos";
import AddQuestion from "./pages/AddQuestion";
import ManageQuestions from "./pages/ManageQuestions";
import AdminResults from "./pages/AdminResults";
import EditVideo from "./pages/EditVideo";
import EditQuestion from "./pages/EditQuestion";

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
  <Route path="courses" element={<ManageCourses />} />
  <Route path="add-course" element={<AddCourse />} />
  <Route path="videos" element={<ManageVideos />} />
  <Route path="add-video" element={<AddVideo />} />
  <Route path="questions" element={<ManageQuestions />} />
  <Route path="add-question" element={<AddQuestion />} />
  <Route path="results" element={<AdminResults />} />
  <Route path="edit-video/:id" element={<EditVideo />} />
  <Route path="edit-question/:videoId/:questionId" element={<EditQuestion />} />
</Route>
        <Route
          path="/admin/users"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <ManageUsers />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/add-course"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <AddCourse />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/courses"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <ManageCourses />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/add-video"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <AddVideo />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/videos"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <ManageVideos />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/add-question"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <AddQuestion />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/questions"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <ManageQuestions />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/results"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <AdminResults />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/edit-video/:id"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <EditVideo />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/edit-question/:videoId/:questionId"
          element={
            <RoleRoute allowedRoles={["admin", "superAdmin"]}>
              <EditQuestion />
            </RoleRoute>
          }
        />

     <Route
  path="/department-admin"
  element={
    <RoleRoute allowedRoles={["departmentAdmin"]}>
      <DepartmentAdminLayout />
    </RoleRoute>
  }
>
  <Route index element={<DepartmentAdminDashboard />} />
  <Route path="assignments" element={<DepartmentAssignTraining />} />
</Route>

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/course/:id"
          element={
            <ProtectedRoute>
              <CourseDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/video/:id"
          element={
            <ProtectedRoute>
              <VideoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz/:id"
          element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/result/:id"
          element={
            <ProtectedRoute>
              <ResultPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/certificate/:id"
          element={
            <ProtectedRoute>
              <CertificatePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-results"
          element={
            <ProtectedRoute>
              <MyResults />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;