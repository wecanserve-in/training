import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FiAward,
  FiBell,
  FiBookOpen,
  FiCheckCircle,
  FiChevronDown,
  FiChevronsLeft,
  FiChevronsRight,
  FiClock,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiUser,
  FiVideo,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import PageOutlet from "./PageOutlet";
import ProfileCompletionBadge from "./ProfileCompletionBadge";
import useShellUser from "../hooks/useShellUser";
import useNotificationsFeed from "../hooks/useNotificationsFeed";
import { formatRoleLabel } from "../lib/userAccess";
import "../styles/appshell.css";

const COLLAPSE_KEY = "app-sidebar-collapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diffMins = Math.floor((Date.now() - date) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const notificationIcon = (type) => {
  if (type === "doubt_reply" || type === "doubt" || type === "course_discussion") return <FiMessageSquare />;
  if (type === "course_assigned") return <FiBookOpen />;
  if (type === "new_video" || type === "course_updated") return <FiVideo />;
  if (type === "quiz_updated") return <FiClock />;
  if (type === "course_removed") return <FiXCircle />;
  if (type === "course_completed") return <FiCheckCircle />;
  if (type === "certificate_ready") return <FiAward />;
  return <FiBell />;
};

/** Closes a popover on outside click or Escape. */
const useDismiss = (open, setOpen, ref) => {
  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, ref]);
};

/** True at desktop widths, where the sidebar can be an icon rail. */
const useIsDesktop = () => {
  const query = "(min-width: 1025px)";
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setIsDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
};

const pathMatches = (pathname, to, end) =>
  end ? pathname === to || pathname === `${to}/` : pathname === to || pathname.startsWith(`${to}/`);

/* ---------------------------------------------------------------- */

function NotificationBell({ feed, basePath }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useDismiss(open, setOpen, wrapRef);

  const recent = feed.notifications.slice(0, 8);

  const openNotification = async (item) => {
    if (!item.read) await feed.markRead(item.notificationId);
    setOpen(false);
    if (item.type === "course_completed") navigate(`${basePath}/assigned-courses`);
    else if (item.courseId) navigate(`${basePath}/course/${item.courseId}`);
  };

  return (
    <div className="shell-popover-wrap" ref={wrapRef}>
      <button
        type="button"
        className="shell-icon-btn"
        onClick={() => setOpen((value) => !value)}
        aria-label={feed.unreadCount ? `Notifications, ${feed.unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <FiBell />
        {feed.unreadCount > 0 && (
          <span className="shell-count-badge">{feed.unreadCount > 99 ? "99+" : feed.unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="shell-popover shell-notifications" role="dialog" aria-label="Notifications">
          <div className="shell-popover-head">
            <h3>Notifications</h3>
            {feed.unreadCount > 0 && (
              <button type="button" className="shell-link-btn" onClick={feed.markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="shell-notif-list">
            {recent.length === 0 ? (
              <div className="shell-notif-empty">
                <FiBell aria-hidden="true" />
                <p>You&apos;re all caught up</p>
              </div>
            ) : (
              recent.map((item) => (
                <button
                  type="button"
                  key={item.notificationId}
                  className={`shell-notif-item ${item.read ? "" : "unread"}`}
                  onClick={() => openNotification(item)}
                >
                  <span className={`shell-notif-icon type-${item.type || "general"}`}>
                    {notificationIcon(item.type)}
                  </span>
                  <span className="shell-notif-text">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{formatTime(item.createdAt)}</small>
                  </span>
                  {!item.read && <span className="shell-unread-dot" aria-label="Unread" />}
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="shell-popover-foot"
            onClick={() => {
              setOpen(false);
              navigate(`${basePath}/notifications`);
            }}
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}

function AccountMenu({ user, subtitle, profilePath, onLogout }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useDismiss(open, setOpen, wrapRef);

  const name = user?.name || "Account";

  return (
    <div className="shell-popover-wrap" ref={wrapRef}>
      <button
        type="button"
        className="shell-account-btn"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="shell-avatar">
          {user?.photoURL ? <img src={user.photoURL} alt="" /> : initialsOf(name)}
        </span>
        <span className="shell-account-name">{name}</span>
        <FiChevronDown className="shell-account-caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="shell-popover shell-account-menu" role="menu">
          <div className="shell-account-head">
            <span className="shell-avatar large">
              {user?.photoURL ? <img src={user.photoURL} alt="" /> : initialsOf(name)}
            </span>
            <span>
              <strong>{name}</strong>
              <small>{subtitle}</small>
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="shell-menu-item"
            onClick={() => {
              setOpen(false);
              navigate(profilePath);
            }}
          >
            <FiUser aria-hidden="true" /> My profile
          </button>
          <button type="button" role="menuitem" className="shell-menu-item danger" onClick={onLogout}>
            <FiLogOut aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function NavGroup({ group, collapsed, pathname, onNavigate }) {
  const containsActive = group.children.some((child) => pathMatches(pathname, child.to, child.end));
  const [open, setOpen] = useState(containsActive);

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  const Icon = group.icon;

  return (
    <div className={`shell-group ${open ? "open" : ""} ${containsActive ? "has-active" : ""}`}>
      <button
        type="button"
        className="shell-nav-link shell-group-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        data-tooltip={group.label}
      >
        <Icon className="shell-nav-icon" aria-hidden="true" />
        <span className="shell-nav-label">{group.label}</span>
        <FiChevronDown className="shell-group-caret" aria-hidden="true" />
      </button>

      {/* Expanded sidebar: inline list. Collapsed rail: flyout on hover/focus. */}
      <div className={collapsed ? "shell-flyout" : "shell-group-items"} role="group" aria-label={group.label}>
        {collapsed && <div className="shell-flyout-title">{group.label}</div>}
        {group.children.map((child) => (
          <NavLink key={child.to} to={child.to} end={child.end} onClick={onNavigate} className="shell-sub-link">
            {child.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

/**
 * The app frame for every role: sidebar (full or icon rail), top bar with
 * page title, notifications and account menu, and a drawer on phones/tablets.
 *
 * nav: [{ to, label, icon, end?, badge? } | { label, icon, children: [{ to, label, end? }] }]
 */
function AppShell({ basePath = "", homePath, nav, subtitleFor, hideProfileBadge }) {
  const { pathname } = useLocation();
  const { user, logout } = useShellUser();
  const feed = useNotificationsFeed(user?.id);

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const railMode = collapsed && isDesktop;

  const profilePath = `${basePath}/profile`;
  const subtitle = subtitleFor ? subtitleFor(user) : user?.email || formatRoleLabel(user?.role);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        // Not saved; fine.
      }
      return !value;
    });
  };

  // Close the drawer when the route changes; lock page scroll while it is open.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    document.body.classList.toggle("shell-drawer-open", drawerOpen);
    return () => document.body.classList.remove("shell-drawer-open");
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const navWithBadges = useMemo(
    () =>
      nav.map((item) =>
        item.badge === "notifications" ? { ...item, badgeCount: feed.unreadCount } : item
      ),
    [nav, feed.unreadCount]
  );

  // Page title for the top bar, taken from the menu.
  const pageTitle = useMemo(() => {
    let best = null;
    nav.forEach((item) => {
      const links = item.children
        ? item.children.map((child) => ({ ...child, group: item.label }))
        : [item];
      links.forEach((link) => {
        if (pathMatches(pathname, link.to, link.end) && (!best || link.to.length > best.to.length)) {
          best = link;
        }
      });
    });
    return best ? { title: best.label, group: best.group } : { title: "", group: "" };
  }, [nav, pathname]);

  const closeDrawer = () => setDrawerOpen(false);
  const name = user?.name || "";

  const renderNav = (isRail) =>
    navWithBadges.map((item) =>
      item.children ? (
        <NavGroup
          key={item.label}
          group={item}
          collapsed={isRail}
          pathname={pathname}
          onNavigate={closeDrawer}
        />
      ) : (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={closeDrawer}
          className="shell-nav-link"
          data-tooltip={item.label}
        >
          <item.icon className="shell-nav-icon" aria-hidden="true" />
          <span className="shell-nav-label">{item.label}</span>
          {item.badgeCount > 0 && (
            <span className="shell-nav-badge" aria-label={`${item.badgeCount} unread`}>
              {item.badgeCount > 99 ? "99+" : item.badgeCount}
            </span>
          )}
        </NavLink>
      )
    );

  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
      <a className="shell-skip-link" href="#main-content">
        Skip to content
      </a>

      {drawerOpen && <div className="shell-backdrop" onClick={closeDrawer} aria-hidden="true" />}

      <aside className="shell-sidebar" aria-label="Main menu">
        <div className="shell-brand">
          <NavLink to={homePath} className="shell-logo" aria-label="Home">
            <img src="/Logo.webp" alt="Zuvius Lifesciences" />
          </NavLink>
          <button
            type="button"
            className="shell-collapse-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
          </button>
          <button type="button" className="shell-drawer-close" onClick={closeDrawer} aria-label="Close menu">
            <FiX />
          </button>
        </div>

        {/* Shown in the phone/tablet drawer, where there is no account menu in view */}
        <NavLink to={profilePath} className="shell-drawer-user" onClick={closeDrawer}>
          <span className="shell-avatar">
            {user?.photoURL ? <img src={user.photoURL} alt="" /> : initialsOf(name)}
          </span>
          <span>
            <strong>{name || "Account"}</strong>
            <small>{subtitle}</small>
          </span>
        </NavLink>

        <nav className="shell-nav">{renderNav(railMode)}</nav>

        <button type="button" className="shell-nav-link shell-logout" onClick={logout} data-tooltip="Log out">
          <FiLogOut className="shell-nav-icon" aria-hidden="true" />
          <span className="shell-nav-label">Log out</span>
        </button>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <button
            type="button"
            className="shell-icon-btn shell-menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <FiMenu />
          </button>

          <NavLink to={homePath} className="shell-topbar-logo" aria-label="Home">
            <img src="/Logo.webp" alt="Zuvius Lifesciences" />
          </NavLink>

          <div className="shell-page-title">
            {pageTitle.group && <span className="shell-crumb">{pageTitle.group}</span>}
            <span className="shell-title">{pageTitle.title}</span>
          </div>

          <div className="shell-topbar-actions">
            <NotificationBell feed={feed} basePath={basePath} />
            <AccountMenu user={user} subtitle={subtitle} profilePath={profilePath} onLogout={logout} />
          </div>
        </header>

        <main id="main-content" className="shell-content" tabIndex={-1}>
          <PageOutlet />
        </main>
      </div>

      {!hideProfileBadge?.(pathname) && <ProfileCompletionBadge profileData={user} profilePath={profilePath} />}
    </div>
  );
}

export default AppShell;
