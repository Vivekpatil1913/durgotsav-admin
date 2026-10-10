import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, MessageSquareWarning, Star, X, XCircle } from "lucide-react";
import { useState } from "react";
import { useUi } from "../context/UiContext.jsx";
import { api, apiError } from "../lib/api.js";
import { fmtNumber } from "../lib/format.js";
import { Spinner } from "./ui.jsx";

// Floating action bar for selected registrations. photoIds (optional) enables "feature in gallery".
export function BulkBar({ selection, photoIds, onDone }) {
  const { toast, confirm } = useUi();
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ids = [...selection.selected];

  async function review(action) {
    if ((action === "reject" || action === "request_info") && !note.trim()) {
      setNoteFor(action);
      return;
    }
    if (action === "verify" && !(await confirm({ title: `Verify ${ids.length} registration(s)?`, message: "Certificates will be issued and emailed / sent to participants.", confirmLabel: "Verify all", tone: "primary" }))) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/registrations/bulk-review", { ids, action, note: note.trim() || undefined });
      toast(`${data.data.updated.length} registration(s) updated`);
      selection.clear();
      setNoteFor(null);
      setNote("");
      onDone();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function feature() {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/registrations/photos/feature", { photo_ids: photoIds(ids), featured: true });
      toast(`${data.data.updated.length} photo(s) added to gallery${data.data.skipped ? ` · ${data.data.skipped} skipped (not verified)` : ""}`);
      selection.clear();
      onDone();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {ids.length > 0 && (
        <motion.div className="bulk-bar" role="region" aria-label="Bulk actions" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
          {noteFor ? (
            <div className="bulk-bar__note">
              <label htmlFor="bulk-note">{noteFor === "reject" ? "Rejection reason" : "What should participants send?"} (shown to {fmtNumber(ids.length)} participant(s))</label>
              <input id="bulk-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} autoFocus maxLength={500} onKeyDown={(e) => e.key === "Enter" && review(noteFor)} />
              <button type="button" className={`btn ${noteFor === "reject" ? "btn--danger" : "btn--primary"}`} disabled={busy || !note.trim()} onClick={() => review(noteFor)}>{busy && <Spinner />} Apply</button>
              <button type="button" className="btn btn--ghost" onClick={() => setNoteFor(null)}>Back</button>
            </div>
          ) : (
            <>
              <strong>{fmtNumber(ids.length)} selected</strong>
              <button type="button" className="btn btn--success btn--sm" disabled={busy} onClick={() => review("verify")}><CheckCircle2 size={15} /> Verify</button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => review("request_info")}><MessageSquareWarning size={15} /> Request info</button>
              <button type="button" className="btn btn--danger-ghost btn--sm" disabled={busy} onClick={() => review("reject")}><XCircle size={15} /> Reject</button>
              {photoIds && <button type="button" className="btn btn--gold btn--sm" disabled={busy} onClick={feature}><Star size={15} /> Feature</button>}
              <button type="button" className="icon-btn" onClick={selection.clear} aria-label="Clear selection"><X size={16} /></button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
