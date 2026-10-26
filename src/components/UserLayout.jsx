import {
  FiAward,
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCheckSquare,
  FiFileText,
  FiHome,
  FiUser,
} from "react-icons/fi";
import AppShell from "./AppShell";

// Learner menu. The Discussion button on video pages sits where the profile reminder would.
const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: FiHome },
  { to: "/assigned-courses", label: "My Courses", icon: FiBookOpen },
  { to: "/my-results", label: "My Results", icon: FiCheckSquare },
  { to: "/certificates", label: "Certificates", icon: FiAward },
  { to: "/my-learnings", label: "My Learnings", icon: FiBarChart2 },
  { to: "/resources", label: "News & Resources", icon: FiFileText },
  { to: "/notifications", label: "Notifications", icon: FiBell, badge: "notifications" },
  { to: "/profile", label: "Profile", icon: FiUser },
];

function UserLayout() {
  return (
    <AppShell
      basePath=""
      homePath="/dashboard"
      nav={NAV}
      subtitleFor={(user) => user?.email || ""}
      hideProfileBadge={(pathname) => pathname.includes("/video/")}
    />
  );
}

export default UserLayout;
