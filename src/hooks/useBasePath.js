import { useLocation } from "react-router-dom";

export default function useBasePath() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/super-admin")) return "/super-admin";
  if (pathname.startsWith("/department-admin")) return "/department-admin";
  if (pathname.startsWith("/admin")) return "/admin";
  return "";
}
