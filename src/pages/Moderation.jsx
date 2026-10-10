import { AlertTriangle, CheckCircle2, Expand, XCircle } from "lucide-react";
import { useState } from "react";
import { BulkBar } from "../components/BulkBar.jsx";
import { RegistrationDrawer } from "../components/RegistrationDrawer.jsx";
import { EmptyState, PageHeader, Pagination, Spinner, useSelection } from "../components/ui.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { api, apiError, assetUrl } from "../lib/api.js";
import { fmtNumber, timeAgo } from "../lib/format.js";

// Photo-first review queue (the 2025 "प्रतिमा निवडा" screen, extended with reject / request-info).
export default function Moderation() {
  const { toast } = useUi();
  const [f, setF] = useQueryState({ status: "pending", district_id: "", fort_id: "", duplicates: "", page: "1" });
  const selection = useSelection();
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const lookups = useFetch("/admin/lookups").data?.data ?? { districts: [], forts: [] };
  const { data, loading, error, reload } = useFetch("/admin/registrations", clean({ ...f, limit: 24, sort: "oldest" }));
  const rows = data?.data ?? [];

  async function quick(id, action) {
    if (action === "reject") return setOpenId(id); // rejection needs a reason — use the drawer
    setBusyId(id);
    try {
      await api.post(`/admin/registrations/${id}/review`, { action });
      toast("Verified — certificate issued");
      reload();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusyId(null);
    }
  }

  const ids = rows.map((r) => r.id);
  const allSelected = ids.length > 0 && ids.every((id) => selection.selected.has(id));

  return (
    <>
      <PageHeader title="Photo review" crumbs={["Participation"]} subtitle="Oldest first. Verify valid photos; open a card to reject with a reason or request more information." />
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Queue">
          {[["pending", "Pending"], ["info_requested", "Info requested"], ["verified", "Verified"], ["rejected", "Rejected"]].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={f.status === k} onClick={() => setF({ status: k })}>{l}</button>
          ))}
        </div>
        <select className="input mr" aria-label="District" value={f.district_id} onChange={(e) => setF({ district_id: e.target.value })}>
          <option value="">All districts</option>
          {lookups.districts.map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="Fort" value={f.fort_id} onChange={(e) => setF({ fort_id: e.target.value })}>
          <option value="">All forts</option>
          {lookups.forts.map((x) => <option key={x.id} value={x.id}>{x.name_mr}</option>)}
        </select>
        <label className="toggle"><input type="checkbox" checked={f.duplicates === "true"} onChange={(e) => setF({ duplicates: e.target.checked ? "true" : "" })} /> Duplicates only</label>
        <label className="toggle"><input type="checkbox" checked={allSelected} onChange={() => selection.onToggleAll(ids, !allSelected)} /> Select page</label>
        <span className="muted toolbar__count">{fmtNumber(data?.meta.total ?? 0)} in queue</span>
      </div>

      {error && <div className="alert alert--error">{error.message}</div>}
      {loading && !rows.length && <div className="photo-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton photo-card--skeleton" />)}</div>}
      {!loading && !rows.length && !error && <EmptyState title="Queue is clear" icon={CheckCircle2}>No registrations with this status.</EmptyState>}

      <div className="photo-grid">
        {rows.map((r) => {
          const selected = selection.selected.has(r.id);
          return (
            <article key={r.id} className={`photo-card ${selected ? "is-selected" : ""}`}>
              <label className="photo-card__check">
                <input type="checkbox" checked={selected} onChange={() => selection.onToggle(r.id)} aria-label={`Select ${r.registration_no}`} />
              </label>
              {r.duplicate_of_photo_id && <span className="photo-card__dup" title="Matches an earlier photo"><AlertTriangle size={13} /> Duplicate</span>}
              <button type="button" className="photo-card__img" onClick={() => setOpenId(r.id)} aria-label={`Open ${r.registration_no}`}>
                {r.thumb_path ? <img src={assetUrl(r.thumb_path)} alt={`Submission by ${r.name}`} loading="lazy" /> : <span>No photo</span>}
                <Expand size={16} className="photo-card__zoom" aria-hidden="true" />
              </button>
              <div className="photo-card__body">
                <strong className="mr">{r.name}</strong>
                <small className="mr">{[r.district, r.fort].filter(Boolean).join(" · ") || r.country}</small>
                <small className="muted">{r.registration_no} · {timeAgo(r.created_at)}</small>
              </div>
              {(r.status === "pending" || r.status === "info_requested") && (
                <div className="photo-card__actions">
                  <button type="button" className="btn btn--success btn--sm" disabled={busyId === r.id} onClick={() => quick(r.id, "verify")}>
                    {busyId === r.id ? <Spinner /> : <CheckCircle2 size={14} />} Verify
                  </button>
                  <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => quick(r.id, "reject")}><XCircle size={14} /> Reject…</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} />

      <BulkBar selection={selection} photoIds={(sel) => rows.filter((r) => sel.includes(r.id) && r.photo_id).map((r) => r.photo_id)} onDone={reload} />
      <RegistrationDrawer id={openId} lookups={lookups} onClose={() => setOpenId(null)} onChanged={reload} />
    </>
  );
}
