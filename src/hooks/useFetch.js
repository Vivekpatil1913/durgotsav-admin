import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiError } from "../lib/api.js";

// GET with loading/error state; cancels the previous in-flight request on each new call
// so rapid filter changes never surface stale data.
export function useFetch(url, params) {
  const key = url ? `${url}?${JSON.stringify(params ?? {})}` : null;
  const [state, setState] = useState({ data: null, loading: Boolean(url), error: null });
  const ctrl = useRef(null);

  const load = useCallback(async () => {
    if (!url) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await api.get(url, { params, signal: ctrl.current.signal });
      setState({ data, loading: false, error: null });
    } catch (err) {
      if (err.code !== "ERR_CANCELED") {
        setState((s) => ({ ...s, loading: false, error: apiError(err) }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
