import { AlertTriangle, CheckCircle2, Copy, Expand, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { BulkBar } from "../components/BulkBar.jsx";
import { RegistrationDrawer } from "../components/RegistrationDrawer.jsx";
import { EmptyState, PageHeader, Pagination, Spinner, useSelection } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { api, apiError, assetUrl } from "../lib/api.js";
import { fmtNumber, timeAgo } from "../lib/format.js";

const QUICK_TOAST = { verify: "Verified — certificate issued", mark_duplicate: "Marked as duplicate", reset: "Moved back to pending" };

// Photo-first review queue (the 2025 "प्रतिमा निवडा" screen, extended with reject / request-info).
export default function Moderation() {
  const { toast, confirm } = useUi();
  const { hasPermission, hasExplicitPermission } = useAuth();
  // moderation_bulk is an "explicit" permission — is_admin does NOT auto-grant it,
  // so Super Admin can turn it off via the Roles page.
  const canBulk = hasExplicitPermission("moderation_bulk");
  const [f, setF] = useQueryState({ status: "pending", division_id: "", district_id: "", taluka_id: "", fort_id: "", limit: "10", page: "1" });
  const selection = useSelection();
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const lookups = useFetch("/admin/lookups").data?.data ?? { divisions: [], districts: [], talukas: [], forts: [] };
  const { data, loading, error, reload } = useFetch("/admin/registrations", clean({ ...f, sort: "oldest" }));
  const rows = data?.data ?? [];
  const districts = f.division_id ? lookups.districts.filter((d) => String(d.division_id) === f.division_id) : [];
  const talukas = f.district_id ? (lookups.talukas ?? []).filter((t) => String(t.district_id) === f.district_id) : [];

  async function quick(id, action) {
    if (action === "reject") return setOpenId(id); // rejection needs a reason — use the drawer
    if (action === "mark_duplicate" && !(await confirm({ title: "Mark as duplicate?", message: "The participant will see that this photo was already used in another registration. Any certificate is revoked.", confirmLabel: "Mark duplicate", tone: "danger" }))) return;
    setBusyId(id);
    try {
      await api.post(`/admin/registrations/${id}/review`, { action });
      toast(QUICK_TOAST[action]);
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
      <div className="resource-tabs" role="tablist" aria-label="Queue">
        {[["pending", "Pending"], ["verified", "Verified"], ["rejected", "Rejected"], ["duplicate", "Duplicates"]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={f.status === k} className={`resource-tab ${f.status === k ? "is-active" : ""}`} onClick={() => setF({ status: k })}>{l}</button>
        ))}
      </div>
      <div className="toolbar">
        <select className="input mr" aria-label="Division" value={f.division_id} onChange={(e) => setF({ division_id: e.target.value, district_id: "", taluka_id: "" })}>
          <option value="">All divisions</option>
          {(lookups.divisions ?? []).map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="District" value={f.district_id} disabled={!f.division_id} onChange={(e) => setF({ district_id: e.target.value, taluka_id: "" })}>
          <option value="">{f.division_id ? "All districts" : "Select division first"}</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="Taluka" value={f.taluka_id} disabled={!f.district_id} onChange={(e) => setF({ taluka_id: e.target.value })}>
          <option value="">{f.district_id ? "All talukas" : "Select district first"}</option>
          {talukas.map((t) => <option key={t.id} value={t.id}>{t.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="Fort" value={f.fort_id} onChange={(e) => setF({ fort_id: e.target.value })}>
          <option value="">All forts</option>
          {lookups.forts.map((x) => <option key={x.id} value={x.id}>{x.name_mr}</option>)}
        </select>
        {canBulk && <label className="toggle"><input type="checkbox" checked={allSelected} onChange={() => selection.onToggleAll(ids, !allSelected)} /> Select page</label>}
        <span className="muted toolbar__count">{fmtNumber(data?.meta.total ?? 0)} in queue</span>
      </div>

      {error && <div className="alert alert--error">{error.message}</div>}
      {loading && !rows.length && <div className="photo-grid">{Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton photo-card--skeleton" />)}</div>}
      {!loading && !rows.length && !error && <EmptyState title="Queue is clear" icon={CheckCircle2}>No registrations with this status.</EmptyState>}

      <div className="photo-grid">
        {rows.map((r) => {
          const selected = selection.selected.has(r.id);
          return (
            <article key={r.id} className={`photo-card ${canBulk && selected ? "is-selected" : ""}`}>
              {canBulk && (
                <label className="photo-card__check">
                  <input type="checkbox" checked={selected} onChange={() => selection.onToggle(r.id)} aria-label={`Select ${r.registration_no}`} />
                </label>
              )}
              {(r.duplicate_of_photo_id || r.status === "duplicate") && <span className="photo-card__dup" title={r.status === "duplicate" ? "Marked as duplicate by an admin" : "Matches an earlier photo"}><AlertTriangle size={13} /> Duplicate</span>}
              <button type="button" className="photo-card__img" onClick={() => setOpenId(r.id)} aria-label={`Open ${r.registration_no}`}>
                {r.thumb_path ? <img src={assetUrl(r.thumb_path)} alt={`Submission by ${r.name}`} loading="lazy" /> : <span>No photo</span>}
                <Expand size={16} className="photo-card__zoom" aria-hidden="true" />
              </button>
              <div className="photo-card__body">
                <strong className="mr">{r.name}</strong>
                <small className="mr">{[r.taluka, r.district, r.fort].filter(Boolean).join(" · ") || r.country}</small>
                <small className="muted">{r.registration_no} · {timeAgo(r.created_at)}</small>
              </div>
              {(r.status === "pending" || r.status === "info_requested") && (
                <div className="photo-card__actions photo-card__actions--wrap">
                  <button type="button" className="btn btn--success btn--sm" disabled={busyId === r.id} onClick={() => quick(r.id, "verify")}>
                    {busyId === r.id ? <Spinner /> : <CheckCircle2 size={14} />} Verify
                  </button>
                  <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => quick(r.id, "reject")}><XCircle size={14} /> Reject…</button>
                  <button type="button" className="btn btn--warning-ghost btn--sm" disabled={busyId === r.id} onClick={() => quick(r.id, "mark_duplicate")}><Copy size={14} /> Mark duplicate</button>
                </div>
              )}
              {r.status === "duplicate" && (
                <div className="photo-card__actions">
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busyId === r.id} onClick={() => quick(r.id, "reset")}>
                    {busyId === r.id ? <Spinner /> : <RotateCcw size={14} />} Not a duplicate
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} jump={false} />

      {canBulk && <BulkBar selection={selection} photoIds={(sel) => rows.filter((r) => sel.includes(r.id) && r.photo_id).map((r) => r.photo_id)} onDone={reload} />}
      <RegistrationDrawer id={openId} lookups={lookups} onClose={() => setOpenId(null)} onChanged={reload} />
    </>
  );
}
