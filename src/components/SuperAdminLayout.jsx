import {
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiFileText,
  FiGrid,
  FiHome,
  FiLayers,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import AppShell from "./AppShell";

const NAV = [
  { to: "/super-admin", label: "Dashboard", icon: FiHome, end: true },
  { to: "/super-admin/admins", label: "Admins", icon: FiShield },
  { to: "/super-admin/departments", label: "Departments", icon: FiGrid },
  { to: "/super-admin/users", label: "Users", icon: FiUsers },
  {
    label: "Training",
    icon: FiLayers,
    children: [
      { to: "/super-admin/courses", label: "Course Library" },
      { to: "/super-admin/video-library", label: "Video Library" },
      { to: "/super-admin/assignments", label: "Assign Course" },
    ],
  },
  {
    label: "Reports",
    icon: FiBarChart2,
    children: [
      { to: "/super-admin/analytics", label: "Progress Report" },
      { to: "/super-admin/assigned-users", label: "Assigned Users" },
      { to: "/super-admin/results", label: "Test Records" },
      { to: "/super-admin/all-certificates", label: "Certifications" },
    ],
  },
  { to: "/super-admin/resources", label: "News & Resources", icon: FiFileText },
  { to: "/super-admin/notifications", label: "Notifications", icon: FiBell, badge: "notifications" },
  {
    label: "My Learning",
    icon: FiBookOpen,
    children: [
      { to: "/super-admin/assigned-courses", label: "Assigned Courses" },
      { to: "/super-admin/my-learnings", label: "My Progress" },
      { to: "/super-admin/my-results", label: "My Test Results" },
      { to: "/super-admin/certificates", label: "My Certificates" },
      { to: "/super-admin/profile", label: "My Profile" },
    ],
  },
];

function SuperAdminLayout() {
  return (
    <AppShell basePath="/super-admin" homePath="/super-admin" nav={NAV} subtitleFor={() => "Super Admin"} />
  );
}

export default SuperAdminLayout;
