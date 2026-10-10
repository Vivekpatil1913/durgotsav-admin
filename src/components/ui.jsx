import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ImagePlus, Inbox, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { api, apiError, assetUrl } from "../lib/api.js";
import { fmtNumber } from "../lib/format.js";

export function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="spin" aria-hidden="true" />;
}

export function EmptyState({ title = "Nothing here yet", children, icon: Icon = Inbox }) {
  return (
    <div className="empty">
      <Icon aria-hidden="true" />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, crumbs = [], actions }) {
  return (
    <header className="page-header">
      <div>
        <nav aria-label="Breadcrumb" className="crumbs">
          {["Admin", ...crumbs].map((c, i) => <span key={i}>{c}</span>)}
        </nav>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

// Side drawer used for create/edit/detail. Esc and backdrop click close it; focus moves inside on open.
export function Drawer({ open, onClose, title, children, footer, wide }) {
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    setTimeout(() => panel.current?.querySelector("input, select, textarea, button")?.focus(), 60);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay overlay--drawer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.aside
            ref={panel}
            className={`drawer ${wide ? "drawer--wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <header className="drawer__head">
              <h2>{title}</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="drawer__body">{children}</div>
            {footer && <footer className="drawer__foot">{footer}</footer>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta) return null;
  const { page, totalPages, total, limit } = meta;
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  return (
    <div className="pagination">
      <span>{fmtNumber(from)}–{fmtNumber(to)} of {fmtNumber(total)}</span>
      <div>
        <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="pagination__page">Page {page} / {totalPages}</span>
        <button type="button" className="icon-btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

/**
 * columns: [{ key, label, render?(row), width?, className? }]
 * selection: { selected:Set, onToggle(id), onToggleAll(ids) } (optional)
 */
export function DataTable({ columns, rows, loading, error, onRowClick, selection, empty, rowKey = (r) => r.id }) {
  const ids = (rows ?? []).map(rowKey);
  const allSelected = selection && ids.length > 0 && ids.every((id) => selection.selected.has(id));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {selection && (
              <th className="table__check">
                <input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={() => selection.onToggleAll(ids, !allSelected)} />
              </th>
            )}
            {columns.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading && !rows?.length &&
            Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className="table__skeleton">
                {selection && <td />}
                {columns.map((c) => <td key={c.key}><span className="skeleton" /></td>)}
              </tr>
            ))}
          {!loading && error && (
            <tr><td colSpan={columns.length + (selection ? 1 : 0)}><div className="alert alert--error">{error.message}</div></td></tr>
          )}
          {!loading && !error && rows?.length === 0 && (
            <tr><td colSpan={columns.length + (selection ? 1 : 0)}><EmptyState title={empty || "No records found"} /></td></tr>
          )}
          {rows?.map((row) => {
            const id = rowKey(row);
            return (
              <tr
                key={id}
                className={`${onRowClick ? "is-clickable" : ""} ${selection?.selected.has(id) ? "is-selected" : ""} ${loading ? "is-stale" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === "Enter" && e.target === e.currentTarget && onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {selection && (
                  <td className="table__check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label="Select row" checked={selection.selected.has(id)} onChange={() => selection.onToggle(id)} />
                  </td>
                )}
                {columns.map((c) => <td key={c.key} className={c.className}>{c.render ? c.render(row) : row[c.key] ?? "—"}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function useSelection() {
  const [selected, setSelected] = useState(new Set());
  return {
    selected,
    clear: () => setSelected(new Set()),
    onToggle: (id) => setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    }),
    onToggleAll: (ids, on) => setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    }),
  };
}

export function Field({ label, error, hint, required, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span className="req">*</span>}</label>
      {children({ id, "aria-invalid": error ? true : undefined })}
      {hint && !error && <small className="field__hint">{hint}</small>}
      {error && <small className="field__error" role="alert">{error}</small>}
    </div>
  );
}

// Uploads to /api/admin/uploads and returns the stored public URL via onChange.
export function ImageUpload({ value, onChange, folder = "content", label = "Image" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await api.post(`/admin/uploads?folder=${folder}`, body);
      onChange(data.data.url);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="image-upload">
      {value ? (
        <div className="image-upload__preview">
          <img src={assetUrl(value)} alt="" />
          <div className="image-upload__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Spinner /> : <ImagePlus size={14} />} Replace</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(null)}><Trash2 size={14} /> Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="image-upload__empty" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Spinner size={22} /> : <ImagePlus size={22} />}
          <span>{busy ? "Uploading…" : `Upload ${label.toLowerCase()}`}</span>
          <small>JPG, PNG or WebP · converted to WebP</small>
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
      {error && <small className="field__error">{error}</small>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "brand", hint, onClick }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp type={onClick ? "button" : undefined} className={`stat-card stat-card--${tone}`} onClick={onClick}>
      <span className="stat-card__icon"><Icon size={18} aria-hidden="true" /></span>
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{fmtNumber(value)}</strong>
      {hint && <span className="stat-card__hint">{hint}</span>}
    </Comp>
  );
}

// Daily bars with accessible table fallback
export function BarChart({ data, height = 160, label }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 100 / data.length;
  return (
    <figure className="bar-chart" aria-label={label}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" role="img" aria-hidden="true">
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2="100" y1={height - f * (height - 10)} y2={height - f * (height - 10)} className="bar-chart__grid" />)}
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 10);
          return <rect key={d.day} x={i * w + w * 0.18} width={w * 0.64} y={height - h} height={Math.max(h, d.count ? 1.5 : 0)} rx="0.6" className="bar-chart__bar"><title>{`${d.day}: ${d.count}`}</title></rect>;
        })}
      </svg>
      <figcaption className="bar-chart__axis"><span>{data[0]?.day}</span><span>max {fmtNumber(max)}/day</span><span>{data[data.length - 1]?.day}</span></figcaption>
    </figure>
  );
}

export function HBarList({ items, labelKey = "name", valueKey = "count", limit = 8 }) {
  const max = Math.max(1, ...items.map((i) => i[valueKey]));
  return (
    <ul className="hbar-list">
      {items.slice(0, limit).map((i) => (
        <li key={i[labelKey]}>
          <span className="hbar-list__label">{i[labelKey]}</span>
          <span className="hbar-list__track"><span style={{ width: `${(i[valueKey] / max) * 100}%` }} /></span>
          <span className="hbar-list__value">{fmtNumber(i[valueKey])}</span>
        </li>
      ))}
    </ul>
  );
}
