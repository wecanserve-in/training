import {
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiFileText,
  FiHome,
  FiLayers,
  FiUsers,
} from "react-icons/fi";
import AppShell from "./AppShell";

const NAV = [
  { to: "/department-admin", label: "Dashboard", icon: FiHome, end: true },
  { to: "/department-admin/members", label: "Members", icon: FiUsers },
  {
    label: "Training",
    icon: FiLayers,
    children: [
      { to: "/department-admin/courses", label: "Course Library" },
      { to: "/department-admin/video-library", label: "Video Library" },
      { to: "/department-admin/questions", label: "Questions" },
      { to: "/department-admin/assignments", label: "Assign Course" },
    ],
  },
  {
    label: "Reports",
    icon: FiBarChart2,
    children: [
      { to: "/department-admin/analytics", label: "Progress Report" },
      { to: "/department-admin/test-logs", label: "Test Logs" },
      { to: "/department-admin/assigned-users", label: "Assigned Users" },
      { to: "/department-admin/all-certificates", label: "Certifications" },
    ],
  },
  { to: "/department-admin/resources", label: "News & Resources", icon: FiFileText },
  { to: "/department-admin/notifications", label: "Notifications", icon: FiBell, badge: "notifications" },
  {
    label: "My Learning",
    icon: FiBookOpen,
    children: [
      { to: "/department-admin/assigned-courses", label: "My Courses" },
      { to: "/department-admin/my-learnings", label: "My Progress" },
      { to: "/department-admin/my-results", label: "My Results" },
      { to: "/department-admin/certificates", label: "Certificates" },
      { to: "/department-admin/profile", label: "Profile" },
    ],
  },
];

function DepartmentAdminLayout() {
  return (
    <AppShell
      basePath="/department-admin"
      homePath="/department-admin"
      nav={NAV}
      subtitleFor={(user) => user?.department || "Department Admin"}
    />
  );
}

export default DepartmentAdminLayout;
