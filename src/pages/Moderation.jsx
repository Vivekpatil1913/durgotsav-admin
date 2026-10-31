import { AlertTriangle, CheckCircle2, Copy, Expand, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { BulkBar } from "../components/BulkBar.jsx";
import { RegistrationDrawer } from "../components/RegistrationDrawer.jsx";
import { EmptyState, PageHeader, Pagination, Spinner, useSelection } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { api, apiError, assetUrl } from "../lib/api.js";
import { fmtNumber, timeAgo } from "../lib/format.js";

// The certificate is generated only on approval; its email and SMS are queued then
const QUICK_TOAST = { verify: "Approved — certificate generated, email and SMS queued", mark_duplicate: "Marked as duplicate", reset: "Moved back to pending" };

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

  // The drawer walks the whole queue, not just the cards on this page: Previous / Next and "3 of 25" come from the
  // server (GET …/:id/neighbors) with the queue's filters and order, so they stay right while other admins review.
  const queueParams = clean({
    status: f.status, division_id: f.division_id, district_id: f.district_id, taluka_id: f.taluka_id, fort_id: f.fort_id, sort: "oldest",
  });
  const around = useFetch(openId ? `/admin/registrations/${openId}/neighbors` : null, queueParams);
  const openRef = useRef(null);
  const open = useCallback((id) => {
    openRef.current = id;
    setOpenId(id);
  }, []);
  const closeDrawer = useCallback(() => open(null), [open]);

  // After verify / reject / duplicate / request info the record leaves the queue: the server says which one followed it
  async function reviewed(registration) {
    reload();
    try {
      const { data: res } = await api.get(`/admin/registrations/${registration.id}/neighbors`, { params: queueParams });
      if (openRef.current !== registration.id) return; // the admin closed the drawer or moved on meanwhile
      const next = res.data;
      if (next.next_id) return open(next.next_id);
      open(null);
      toast(next.total ? `Reached the end of this queue — ${fmtNumber(next.total)}${next.capped ? "+" : ""} still waiting` : "Queue is clear — nothing left to review", "info");
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  }

  // Only neighbours fetched for the record on screen count; while the new ones load, the buttons wait
  const here = around.data?.data?.id === openId ? around.data.data : null;
  const nav = openId && {
    // Counting stops at 10,000 (capped): "1 of 10,000+"
    position: !here ? "…" : `${here.position ? fmtNumber(here.position) : "–"} of ${fmtNumber(here.total)}${here.capped ? "+" : ""}`,
    prev: here?.prev_id ? () => open(here.prev_id) : null,
    next: here?.next_id ? () => open(here.next_id) : null,
  };
  // District is the location the form asks for (SRS v2.1): every district is listed; a division narrows the list
  const districts = f.division_id ? lookups.districts.filter((d) => String(d.division_id) === f.division_id) : lookups.districts;
  const talukas = f.district_id ? (lookups.talukas ?? []).filter((t) => String(t.district_id) === f.district_id) : [];

  async function quick(id, action) {
    if (action === "reject") return open(id); // rejection needs a reason — use the drawer
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
      <PageHeader title="Photo review" crumbs={["Participation"]} subtitle="Oldest first. Check each photo and its details: approving generates the participant's certificate and sends it by email and SMS; rejecting gives none. Open a card to give a reason or request more information." />
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
        <select className="input mr" aria-label="District" value={f.district_id} onChange={(e) => setF({ district_id: e.target.value, taluka_id: "" })}>
          <option value="">All districts</option>
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
        <span className="muted toolbar__count">{fmtNumber(data?.meta.total ?? 0)}{data?.meta.capped ? "+" : ""} in queue</span>
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
              <button type="button" className="photo-card__img" onClick={() => open(r.id)} aria-label={`Open ${r.registration_no}`}>
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
                    {busyId === r.id ? <Spinner /> : <CheckCircle2 size={14} />} Approve
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
      <RegistrationDrawer id={openId} lookups={lookups} onClose={closeDrawer} onChanged={reload} onReviewed={reviewed} nav={nav} />
    </>
  );
}
