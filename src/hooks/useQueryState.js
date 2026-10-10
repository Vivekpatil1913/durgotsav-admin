import { useSearchParams } from "react-router-dom";

// Filter state kept in the URL, so filtered views can be bookmarked / shared and survive reloads.
export function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();
  const state = Object.fromEntries(Object.entries(defaults).map(([k, d]) => [k, params.get(k) ?? d]));
  const set = (patch) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      Object.entries(patch).forEach(([k, v]) => (v === "" || v == null || v === defaults[k] ? next.delete(k) : next.set(k, v)));
      if (!("page" in patch)) next.delete("page");
      return next;
    }, { replace: true });
  return [state, set];
}

export const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v != null));
