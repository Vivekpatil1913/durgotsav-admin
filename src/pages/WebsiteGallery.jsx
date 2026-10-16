import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Images,
  MapPin,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer, EmptyState, PageHeader, Pagination, Spinner, useSelection } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useDebounced, useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { api, apiError, assetUrl, SITE_URL } from "../lib/api.js";
import { fmtDateTime, fmtNumber, PARTICIPANT_TYPES } from "../lib/format.js";

const DEFAULTS = {
  display_status: "all",
  division_id: "",
  district_id: "",
  taluka_id: "",
  fort_id: "",
  sort: "display_first",
  limit: "20",
  page: "1",
  q: "",
};

export default function WebsiteGallery() {
  const { toast, confirm } = useUi();
  const { hasPermission, hasExplicitPermission } = useAuth();

  const canEdit = hasPermission("website_gallery", "write");
  const canBulk = hasExplicitPermission("website_gallery_bulk") && canEdit;

  const [f, setF] = useQueryState(DEFAULTS);
  const [search, setSearch] = useState(f.q);
  const debouncedQ = useDebounced(search);
  const selection = useSelection();

  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    if (debouncedQ !== f.q) setF({ q: debouncedQ, page: "1" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const lookups = useFetch("/admin/lookups").data?.data ?? { divisions: [], districts: [], talukas: [], forts: [] };
  const queryParams = clean({ ...f });
  const { data, loading, error, reload } = useFetch("/admin/website-gallery", queryParams);

  const payload = data?.data ?? {};
  const rows = payload.data ?? [];
  const meta = payload.meta;
  const counts = payload.counts ?? {
    filter_total: 0,
    filter_selected: 0,
    filter_unselected: 0,
    total_verified: 0,
    total_on_website: 0,
    total_off_website: 0,
  };

  const districts = f.division_id ? lookups.districts.filter((d) => String(d.division_id) === f.division_id) : [];
  const talukas = f.district_id ? (lookups.talukas ?? []).filter((t) => String(t.district_id) === f.district_id) : [];

  // Toggle single photo display status
  async function toggleDisplay(photo, targetFeatured) {
    if (!canEdit) {
      toast("You do not have permission to modify website gallery display", "error");
      return;
    }
    setBusyId(photo.photo_id);
    try {
      await api.post("/admin/website-gallery/toggle", {
        photo_id: photo.photo_id,
        featured: targetFeatured,
      });
      toast(targetFeatured ? "Added to website Home & Gallery display" : "Removed from website display");
      if (previewPhoto && previewPhoto.photo_id === photo.photo_id) {
        setPreviewPhoto((prev) => (prev ? { ...prev, is_featured: targetFeatured } : null));
      }
      reload();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusyId(null);
    }
  }

  // Bulk add/remove from website display
  async function handleBulkSet(targetFeatured) {
    if (!canBulk) {
      toast("You do not have permission for bulk gallery actions", "error");
      return;
    }
    const ids = [...selection.selected];
    if (!ids.length) return;

    const actionText = targetFeatured ? "add to website display" : "remove from website display";
    const ok = await confirm({
      title: `${targetFeatured ? "Add" : "Remove"} ${ids.length} photo(s)?`,
      message: `Are you sure you want to ${actionText} for ${ids.length} selected verified photo(s)?`,
      confirmLabel: targetFeatured ? "Add to website" : "Remove from website",
      tone: targetFeatured ? "primary" : "danger",
    });
    if (!ok) return;

    setBulkBusy(true);
    try {
      const res = await api.post("/admin/website-gallery/bulk", {
        photo_ids: ids,
        featured: targetFeatured,
      });
      toast(`${res.data.data.count} photo(s) ${targetFeatured ? "added to website display" : "removed from website display"}`);
      selection.clear();
      reload();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  const pagePhotoIds = rows.map((r) => r.photo_id);
  const allPageSelected = pagePhotoIds.length > 0 && pagePhotoIds.every((id) => selection.selected.has(id));

  return (
    <>
      <PageHeader
        title="Website Gallery"
        crumbs={["Content"]}
        subtitle="Manage verified participant photos displayed on the website's Home Page and Gallery section. Only admin-selected photos appear publicly."
        actions={
          <div className="cluster">
            <a
              href={`${SITE_URL}/gallery`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost"
              title="Open public gallery in a new tab"
            >
              <ExternalLink size={15} /> View public gallery
            </a>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="resource-tabs" role="tablist" aria-label="Gallery display filter">
        {[
          { key: "all", label: "All verified photos", count: counts.total_verified },
          { key: "selected", label: "On website", count: counts.total_on_website },
          { key: "unselected", label: "Not on website", count: counts.total_off_website },
        ].map((tab) => {
          const active = f.display_status === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`resource-tab ${active ? "is-active" : ""}`}
              onClick={() => setF({ display_status: tab.key, page: "1" })}
            >
              {tab.label}
              {tab.count !== undefined && <span className="tab-badge">{fmtNumber(tab.count)}</span>}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input
            className="input"
            placeholder="Participant, mobile, fort or reg. no"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select
          className="input mr"
          aria-label="Division"
          value={f.division_id}
          onChange={(e) => setF({ division_id: e.target.value, district_id: "", taluka_id: "", page: "1" })}
        >
          <option value="">All divisions</option>
          {(lookups.divisions ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name_mr}
            </option>
          ))}
        </select>

        <select
          className="input mr"
          aria-label="District"
          value={f.district_id}
          disabled={!f.division_id}
          onChange={(e) => setF({ district_id: e.target.value, taluka_id: "", page: "1" })}
        >
          <option value="">{f.division_id ? "All districts" : "Select division first"}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name_mr}
            </option>
          ))}
        </select>

        <select
          className="input mr"
          aria-label="Taluka"
          value={f.taluka_id}
          disabled={!f.district_id}
          onChange={(e) => setF({ taluka_id: e.target.value, page: "1" })}
        >
          <option value="">{f.district_id ? "All talukas" : "Select district first"}</option>
          {talukas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name_mr}
            </option>
          ))}
        </select>

        <select
          className="input mr"
          aria-label="Fort"
          value={f.fort_id}
          onChange={(e) => setF({ fort_id: e.target.value, page: "1" })}
        >
          <option value="">All forts</option>
          {lookups.forts.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name_mr}
            </option>
          ))}
        </select>

        <select
          className="input"
          aria-label="Sort"
          value={f.sort}
          onChange={(e) => setF({ sort: e.target.value, page: "1" })}
        >
          <option value="display_first">On website first</option>
          <option value="display_last">Not on website first</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Participant Name A–Z</option>
        </select>

        {canBulk && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={allPageSelected}
              onChange={() => selection.onToggleAll(pagePhotoIds, !allPageSelected)}
            />{" "}
            Select page
          </label>
        )}

        <span className="muted toolbar__count">
          <strong>{fmtNumber(counts.filter_selected)}</strong> on website of {fmtNumber(counts.filter_total)} verified
        </span>
      </div>

      {error && <div className="alert alert--error">{error.message}</div>}

      {loading && !rows.length && (
        <div className="photo-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton photo-card--skeleton" />
          ))}
        </div>
      )}

      {!loading && !rows.length && !error && (
        <EmptyState title="No verified photos found" icon={Images}>
          {f.display_status === "selected"
            ? "No verified photos have been added to the website gallery yet. Switch to 'All verified photos' to curate photos for display."
            : "No photos match these filters."}
        </EmptyState>
      )}

      {/* Grid of Verified Photos */}
      <div className="photo-grid">
        {rows.map((r) => {
          const isSelected = selection.selected.has(r.photo_id);
          const isLive = Boolean(r.is_featured);

          return (
            <article
              key={r.photo_id}
              className={`photo-card ${isLive ? "is-featured" : ""} ${isSelected ? "is-selected" : ""}`}
            >
              {canBulk && (
                <label className="photo-card__check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => selection.onToggle(r.photo_id)}
                    aria-label={`Select ${r.registration_no}`}
                  />
                </label>
              )}

              {/* Status pill badge on top right */}
              <span
                className={`photo-card__badge ${isLive ? "photo-card__badge--live" : "photo-card__badge--off"}`}
                title={isLive ? "Currently visible on Website Home & Gallery" : "Not displayed on website"}
              >
                {isLive ? (
                  <>
                    <CheckCircle2 size={12} aria-hidden="true" /> On website
                  </>
                ) : (
                  <>
                    <EyeOff size={12} aria-hidden="true" /> Hidden
                  </>
                )}
              </span>

              {/* Image preview button */}
              <button
                type="button"
                className="photo-card__img"
                onClick={() => setPreviewPhoto(r)}
                aria-label={`Preview photo by ${r.participant_name}`}
              >
                {r.thumb_path ? (
                  <img src={assetUrl(r.thumb_path)} alt={`Submission by ${r.participant_name}`} loading="lazy" />
                ) : (
                  <span>No photo</span>
                )}
                <span className="photo-card__zoom" title="Click to view details">
                  <Images size={15} aria-hidden="true" />
                </span>
              </button>

              {/* Body */}
              <div className="photo-card__body">
                <strong className="mr" title={r.participant_name}>
                  {r.participant_name}
                </strong>
                <small className="mr">
                  {PARTICIPANT_TYPES[r.participant_type] ?? r.participant_type}
                  {r.organization_name ? ` · ${r.organization_name}` : ""}
                </small>
                <small className="mr">
                  {[r.taluka_name, r.district_name, r.fort_name].filter(Boolean).join(" · ") || r.city || "Maharashtra"}
                </small>
                <small className="muted mono">
                  {r.registration_no} · {r.submitted_at ? fmtDateTime(r.submitted_at).split(",")[0] : ""}
                </small>
              </div>

              {/* Action Buttons */}
              <div className="photo-card__actions">
                {canEdit ? (
                  isLive ? (
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      disabled={busyId === r.photo_id}
                      onClick={() => toggleDisplay(r, false)}
                      title="Remove this photo from website home & gallery display"
                    >
                      {busyId === r.photo_id ? <Spinner size={13} /> : <EyeOff size={14} />} Remove from website
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--success btn--sm"
                      disabled={busyId === r.photo_id}
                      onClick={() => toggleDisplay(r, true)}
                      title="Display this photo on the public website Home & Gallery"
                    >
                      {busyId === r.photo_id ? <Spinner size={13} /> : <Eye size={14} />} Add to website
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setPreviewPhoto(r)}
                  >
                    View details
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {meta && (
        <Pagination
          meta={meta}
          onPage={(p) => setF({ page: String(p) })}
          jump={false}
        />
      )}

      {/* Floating Bulk Action Bar */}
      {canBulk && selection.selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions for Website Gallery">
          <strong>{fmtNumber(selection.selected.size)} selected</strong>
          <button
            type="button"
            className="btn btn--success btn--sm"
            disabled={bulkBusy}
            onClick={() => handleBulkSet(true)}
          >
            {bulkBusy ? <Spinner size={13} /> : <Eye size={14} />} Add to website
          </button>
          <button
            type="button"
            className="btn btn--danger-ghost btn--sm"
            disabled={bulkBusy}
            onClick={() => handleBulkSet(false)}
          >
            {bulkBusy ? <Spinner size={13} /> : <EyeOff size={14} />} Remove from website
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={selection.clear}
            aria-label="Clear selection"
            title="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Detailed Photo Preview Drawer */}
      <Drawer
        open={Boolean(previewPhoto)}
        onClose={() => setPreviewPhoto(null)}
        title={
          previewPhoto ? (
            <div className="cluster cluster--tight">
              <span>{previewPhoto.registration_no}</span>
              <span
                className={`badge ${previewPhoto.is_featured ? "badge--success" : "badge--neutral"}`}
              >
                {previewPhoto.is_featured ? "On website" : "Not on website"}
              </span>
            </div>
          ) : (
            "Photo preview"
          )
        }
        footer={
          previewPhoto && canEdit ? (
            <div className="cluster" style={{ justifyContent: "space-between", width: "100%" }}>
              <span className="muted">
                Status: <strong>{previewPhoto.is_featured ? "Displayed publicly" : "Hidden from website"}</strong>
              </span>
              {previewPhoto.is_featured ? (
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  disabled={busyId === previewPhoto.photo_id}
                  onClick={() => toggleDisplay(previewPhoto, false)}
                >
                  {busyId === previewPhoto.photo_id ? <Spinner size={13} /> : <EyeOff size={16} />} Remove from website
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--success"
                  disabled={busyId === previewPhoto.photo_id}
                  onClick={() => toggleDisplay(previewPhoto, true)}
                >
                  {busyId === previewPhoto.photo_id ? <Spinner size={13} /> : <Eye size={16} />} Add to website display
                </button>
              )}
            </div>
          ) : null
        }
      >
        {previewPhoto && (
          <div className="reg-detail">
            {/* Main high resolution image preview */}
            <div style={{ textAlign: "center", background: "var(--surface-sunken, #2a221b)", borderRadius: "var(--radius-lg, 12px)", padding: "16px", overflow: "hidden" }}>
              <img
                src={assetUrl(previewPhoto.image_path || previewPhoto.thumb_path)}
                alt={`Replica by ${previewPhoto.participant_name}`}
                style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: "8px" }}
              />
            </div>

            <section className="reg-card" style={{ marginTop: 16 }}>
              <h3>Participant details</h3>
              <dl className="kv">
                <dt>Name</dt>
                <dd>
                  <strong className="mr">{previewPhoto.participant_name}</strong>
                </dd>

                <dt>Category</dt>
                <dd>
                  {PARTICIPANT_TYPES[previewPhoto.participant_type] ?? previewPhoto.participant_type}
                  {previewPhoto.organization_name ? ` · ${previewPhoto.organization_name}` : ""}
                </dd>

                <dt>Mobile</dt>
                <dd className="mono">{previewPhoto.phone}</dd>

                {previewPhoto.email && (
                  <>
                    <dt>Email</dt>
                    <dd>{previewPhoto.email}</dd>
                  </>
                )}

                <dt>Fort built</dt>
                <dd>
                  <strong className="mr">{previewPhoto.fort_name || "Other fort"}</strong>
                  {previewPhoto.fort_name_en ? ` (${previewPhoto.fort_name_en})` : ""}
                </dd>

                <dt>Location</dt>
                <dd>
                  {[previewPhoto.taluka_name, previewPhoto.district_name, previewPhoto.division_name]
                    .filter(Boolean)
                    .join(", ") || previewPhoto.city || "—"}
                </dd>

                <dt>Submitted at</dt>
                <dd>{fmtDateTime(previewPhoto.submitted_at)}</dd>

                {previewPhoto.reviewed_at && (
                  <>
                    <dt>Verified at</dt>
                    <dd>{fmtDateTime(previewPhoto.reviewed_at)}</dd>
                  </>
                )}

                <dt>Website display</dt>
                <dd>
                  <span className={`badge ${previewPhoto.is_featured ? "badge--success" : "badge--neutral"}`}>
                    {previewPhoto.is_featured ? "Visible on Home & Gallery" : "Hidden from public website"}
                  </span>
                </dd>
              </dl>
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}

