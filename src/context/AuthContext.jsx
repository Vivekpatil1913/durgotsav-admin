import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setAdmin(null);
  }, []);

  // Re-read the admin (and their role's permissions) so role edits apply without re-login.
  const refresh = useCallback(() => {
    if (!tokenStore.get()) return Promise.resolve();
    return api.get("/auth/me").then((r) => setAdmin(r.data.admin)).catch(() => {});
  }, []);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api.get("/auth/me")
      .then((r) => setAdmin(r.data.admin))
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    tokenStore.set(data.token);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  // True when the admin's role has is_admin = true (super-admin pass-through).
  const isAdmin = useMemo(() => Boolean(admin?.is_admin), [admin]);

  // Check if the admin can perform `level` on `moduleKey`.
  // is_admin roles bypass all permission checks (returns true for everything).
  // Mirrors the server-side canDo() in permissions.registry.js.
  const hasPermission = useCallback((moduleKey, level = "read") => {
    if (!admin) return false;
    if (admin.is_admin) return true;
    const mp = admin.role_permissions?.[moduleKey];
    if (!mp) return false;
    if (level === "read")   return Boolean(mp.read || mp.write || mp.delete);
    if (level === "write")  return Boolean(mp.write || mp.delete);
    if (level === "delete") return Boolean(mp.delete);
    return false;
  }, [admin]);

  // "Explicit" permissions (e.g. moderation_bulk, website_gallery_bulk) read the role JSONB;
  // is_admin defaults to granted unless explicitly turned off on the Roles page.
  const hasExplicitPermission = useCallback(
    (moduleKey) => Boolean(
      admin?.role_permissions?.[moduleKey]?.read ?? admin?.is_admin
    ),
    [admin],
  );

  // Legacy helper kept for existing Protected role checks (super_admin / admin / moderator)
  const can = useCallback((...roles) =>
    Boolean(admin) && (admin.is_admin || roles.includes(admin.role)),
    [admin],
  );

  const value = useMemo(
    () => ({ admin, ready, login, logout, refresh, can, isAdmin, hasPermission, hasExplicitPermission }),
    [admin, ready, login, logout, refresh, can, isAdmin, hasPermission, hasExplicitPermission],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
