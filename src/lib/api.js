import axios from "axios";

export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "http://localhost:5173").replace(/\/$/, "");
const TOKEN_KEY = "dgt26_admin_token";

export const tokenStore = {
  get: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      // sessionStorage: the token dies with the tab, which suits shared office computers
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked */
    }
  },
};

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/login")) onUnauthorized();
    return Promise.reject(err);
  },
);

export function apiError(err) {
  const body = err?.response?.data?.error;
  if (body) return { status: err.response.status, message: body.message, details: body.details || {} };
  return { message: err?.message === "Network Error" ? "Cannot reach the API server" : err?.message || "Request failed", details: {} };
}

export const assetUrl = (p) => (!p ? "" : /^https?:/.test(p) ? p : p.startsWith("/uploads/") ? `${API_URL}${p}` : `${SITE_URL}${p}`);

// Fetches a protected binary (PDF / CSV) with the auth header and hands it to the browser. No time limit: a full CSV
// export streams for as long as it has rows.
export async function downloadFile(url, params, filename, { open = false } = {}) {
  const res = await api.get(url, { params, responseType: "blob", timeout: 0 });
  const href = URL.createObjectURL(res.data);
  if (open) window.open(href, "_blank", "noopener");
  else Object.assign(document.createElement("a"), { href, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
