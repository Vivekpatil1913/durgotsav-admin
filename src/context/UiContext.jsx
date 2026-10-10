import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const UiContext = createContext(null);
const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };

// Toasts + a promise-based confirm dialog: `if (await confirm({...})) doIt()`.
export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const confirmBtn = useRef(null);

  const toast = useCallback((message, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 6000 : 3500);
  }, []);

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setDialog({ title: "Are you sure?", confirmLabel: "Confirm", tone: "danger", ...opts, resolve })),
    [],
  );
  const close = (value) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  useEffect(() => {
    if (!dialog) return undefined;
    confirmBtn.current?.focus();
    const onKey = (e) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.type];
            return (
              <motion.div key={t.id} className={`toast toast--${t.type}`} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} role={t.type === "error" ? "alert" : "status"}>
                <Icon size={18} aria-hidden="true" />
                <span>{t.message}</span>
                <button type="button" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss"><X size={14} /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {dialog && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && close(false)}>
            <motion.div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={`dialog__icon dialog__icon--${dialog.tone}`}><AlertTriangle aria-hidden="true" /></div>
              <h2 id="dlg-title">{dialog.title}</h2>
              {dialog.message && <p>{dialog.message}</p>}
              <div className="dialog__actions">
                <button type="button" className="btn btn--ghost" onClick={() => close(false)}>Cancel</button>
                <button ref={confirmBtn} type="button" className={`btn ${dialog.tone === "danger" ? "btn--danger" : "btn--primary"}`} onClick={() => close(true)}>{dialog.confirmLabel}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </UiContext.Provider>
  );
}

export const useUi = () => useContext(UiContext);
