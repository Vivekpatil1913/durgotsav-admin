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

  // super_admin can do everything; otherwise the role must be listed
  const can = useCallback((...roles) => Boolean(admin) && (admin.role === "super_admin" || roles.includes(admin.role)), [admin]);

  const value = useMemo(() => ({ admin, ready, login, logout, can }), [admin, ready, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
