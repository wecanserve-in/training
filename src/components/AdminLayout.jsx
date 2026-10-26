import {
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiFileText,
  FiGrid,
  FiHome,
  FiLayers,
  FiUsers,
} from "react-icons/fi";
import AppShell from "./AppShell";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: FiHome, end: true },
  { to: "/admin/users", label: "Users", icon: FiUsers },
  { to: "/admin/departments", label: "Departments", icon: FiGrid },
  {
    label: "Training",
    icon: FiLayers,
    children: [
      { to: "/admin/courses", label: "Courses" },
      { to: "/admin/video-library", label: "Videos" },
      { to: "/admin/questions", label: "Questions" },
      { to: "/admin/assignments", label: "Assign Course" },
    ],
  },
  {
    label: "Reports",
    icon: FiBarChart2,
    children: [
      { to: "/admin/analytics", label: "Progress Report" },
      { to: "/admin/assigned-users", label: "Assigned Users" },
      { to: "/admin/results", label: "Test Records" },
      { to: "/admin/all-certificates", label: "Certifications" },
    ],
  },
  { to: "/admin/resources", label: "News & Resources", icon: FiFileText },
  { to: "/admin/notifications", label: "Notifications", icon: FiBell, badge: "notifications" },
  {
    label: "My Learning",
    icon: FiBookOpen,
    children: [
      { to: "/admin/assigned-courses", label: "Assigned Courses" },
      { to: "/admin/my-learnings", label: "My Progress" },
      { to: "/admin/my-results", label: "My Test Results" },
      { to: "/admin/certificates", label: "My Certificates" },
      { to: "/admin/profile", label: "My Profile" },
    ],
  },
];

function AdminLayout() {
  return <AppShell basePath="/admin" homePath="/admin" nav={NAV} subtitleFor={() => "Admin"} />;
}

export default AdminLayout;
