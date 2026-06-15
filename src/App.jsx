import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import VideoPage from "./pages/VideoPage";
import QuizPage from "./pages/QuizPage";
import ResultPage from "./pages/ResultPage";
import CertificatePage from "./pages/CertificatePage";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminDashboard from "./pages/AdminDashboard";
import AddVideo from "./pages/AddVideo";
import ManageVideos from "./pages/ManageVideos";
import AddQuestion from "./pages/AddQuestion";
import ManageQuestions from "./pages/ManageQuestions";
import AdminResults from "./pages/AdminResults";
import EditVideo from "./pages/EditVideo";
import EditQuestion from "./pages/EditQuestion";
import MyResults from "./pages/MyResults";
import CourseDetails from "./pages/CourseDetails";

import AddCourse from "./pages/AddCourse";
import ManageCourses from "./pages/ManageCourses";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

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

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/add-course"
          element={
            <AdminRoute>
              <AddCourse />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/courses"
          element={
            <AdminRoute>
              <ManageCourses />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/add-video"
          element={
            <AdminRoute>
              <AddVideo />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/videos"
          element={
            <AdminRoute>
              <ManageVideos />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/add-question"
          element={
            <AdminRoute>
              <AddQuestion />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/questions"
          element={
            <AdminRoute>
              <ManageQuestions />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/results"
          element={
            <AdminRoute>
              <AdminResults />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/edit-video/:id"
          element={
            <AdminRoute>
              <EditVideo />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/edit-question/:videoId/:questionId"
          element={
            <AdminRoute>
              <EditQuestion />
            </AdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;