import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiError } from "../lib/api.js";

// GET with loading/error state; keeps the previous data while refetching so tables don't flash.
export function useFetch(url, params) {
  const key = url ? `${url}?${JSON.stringify(params ?? {})}` : null;
  const [state, setState] = useState({ data: null, loading: Boolean(url), error: null });
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await api.get(url, { params });
      if (id === latest.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === latest.current) setState((s) => ({ ...s, loading: false, error: apiError(err) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
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
