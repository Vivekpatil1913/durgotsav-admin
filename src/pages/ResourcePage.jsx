import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { FortGallery } from "../components/FortGallery.jsx";
import { initialValues, ResourceForm, toPayload } from "../components/ResourceForm.jsx";
import { Badge, DataTable, Drawer, PageHeader, Pagination, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useDebounced, useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { api, apiError, assetUrl } from "../lib/api.js";
import { fmtDate, fmtDateTime, ROLES } from "../lib/format.js";
import { RESOURCES } from "../resources.js";

const ENQUIRY_TONE = { new: "warning", in_progress: "info", resolved: "success", spam: "neutral" };

function cell(col, row) {
  const v = row[col.key];
  if (col.type === "image") return v ? <img className="thumb" src={assetUrl(v)} alt="" loading="lazy" /> : <span className="thumb thumb--empty" />;
  if (col.type === "datetime") return <small>{fmtDateTime(v)}</small>;
  if (col.type === "bool") return v ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>;
  if (col.type === "status") return <Badge tone={ENQUIRY_TONE[v]}>{String(v).replace("_", " ")}</Badge>;
  if (col.type === "role") return <Badge tone={v === "super_admin" ? "gold" : "neutral"}>{ROLES[v]}</Badge>;
  const sub = row[col.sub] ?? row[col.fallbackSub];
  const main = v ?? (col.fallback ? fmtDate(row[col.fallback]) : "—");
  return sub ? (
    <div className="cell-stack"><strong className={col.mr ? "mr" : ""}>{main}</strong><small>{sub}</small></div>
  ) : <span className={col.mr ? "mr" : ""}>{main}</span>;
}

export default function ResourcePage() {
  const { resource } = useParams();
  const cfg = RESOURCES[resource];
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const [f, setF] = useQueryState({ q: "", is_active: "", trashed: "", page: "1", ...Object.fromEntries((cfg?.filters ?? []).map((x) => [x.key, ""])) });
  const [search, setSearch] = useState(f.q);
  const q = useDebounced(search);
  const [editing, setEditing] = useState(null); // null | 'new' | record
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q !== f.q) setF({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => setSearch(""), [resource]);

  const { data, loading, error, reload } = useFetch(cfg ? cfg.endpoint : null, clean({ ...f, limit: 25 }));
  if (!cfg) return <Navigate to="/" replace />;
  if (!can(...cfg.roles)) return <div className="alert alert--error">You do not have access to {cfg.title}.</div>;

  const rows = data?.data ?? [];
  const trashed = f.trashed === "true";
  const isEdit = editing && editing !== "new";

  function open(record) {
    setErrors({});
    setValues(initialValues(cfg.fields, record));
    setEditing(record ?? "new");
  }

  async function save() {
    const payload = toPayload(cfg.fields, values, isEdit);
    const missing = cfg.fields.filter((x) => x.required && (payload[x.key] === "" || payload[x.key] == null)).map((x) => x.key);
    if (resource === "admins" && !isEdit && !payload.password) missing.push("password");
    if (missing.length) return setErrors(Object.fromEntries(missing.map((k) => [k, "Required"])));
    setSaving(true);
    try {
      const res = isEdit ? await api.put(`${cfg.endpoint}/${editing.id}`, payload) : await api.post(cfg.endpoint, payload);
      toast(`${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} ${isEdit ? "updated" : "created"}`);
      reload();
      if (isEdit || !cfg.gallery) setEditing(null);
      else open(res.data.data); // stay open so fort gallery images can be added
    } catch (err) {
      const e = apiError(err);
      setErrors(e.details || {});
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      reload();
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  };

  async function remove(row) {
    if (!(await confirm({ title: `Move this ${cfg.singular} to trash?`, message: "It disappears from the website and can be restored later.", confirmLabel: "Move to trash" }))) return;
    act(() => api.delete(`${cfg.endpoint}/${row.id}`), "Moved to trash");
    if (editing?.id === row.id) setEditing(null);
  }

  // Swap display order with the neighbour
  async function move(row, dir) {
    const i = rows.indexOf(row);
    const other = rows[i + dir];
    if (!other) return;
    const a = row.sort_order === other.sort_order ? i : row.sort_order;
    const b = row.sort_order === other.sort_order ? i + dir : other.sort_order;
    act(() => api.put(`${cfg.endpoint}/reorder`, { items: [{ id: row.id, sort_order: b }, { id: other.id, sort_order: a }] }), "Order updated");
  }

  const columns = [
    ...cfg.columns.map((c) => ({ key: c.key, label: c.label ?? "", width: c.type === "image" ? 64 : undefined, render: (r) => cell(c, r) })),
    ...(!cfg.noActiveFilter && !trashed && cfg.can.toggle ? [{ key: "is_active", label: "Visible", render: (r) => (
      <button type="button" className={`pill-toggle ${r.is_active ? "is-on" : ""}`} onClick={(e) => { e.stopPropagation(); act(() => api.patch(`${cfg.endpoint}/${r.id}/toggle`), r.is_active ? "Hidden from site" : "Now visible"); }} aria-pressed={r.is_active}>
        {r.is_active ? <Eye size={14} /> : <EyeOff size={14} />} {r.is_active ? "Active" : "Hidden"}
      </button>
    ) }] : []),
    { key: "_actions", label: "", render: (r) => (
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        {cfg.can.reorder && !trashed && (
          <>
            <button type="button" className="icon-btn" onClick={() => move(r, -1)} disabled={rows.indexOf(r) === 0} aria-label="Move up"><ArrowUp size={14} /></button>
            <button type="button" className="icon-btn" onClick={() => move(r, 1)} disabled={rows.indexOf(r) === rows.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
          </>
        )}
        {trashed && cfg.can.restore && <button type="button" className="btn btn--ghost btn--sm" onClick={() => act(() => api.post(`${cfg.endpoint}/${r.id}/restore`), "Restored")}><Undo2 size={14} /> Restore</button>}
        {!trashed && cfg.can.delete && <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(r)} aria-label="Move to trash"><Trash2 size={14} /></button>}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title={cfg.title} crumbs={[resource === "enquiries" ? "Inbox" : resource === "admins" ? "System" : "Content"]}
        actions={cfg.can.create && <button type="button" className="btn btn--primary" onClick={() => open(null)}><Plus size={16} /> New {cfg.singular}</button>} />

      <div className="toolbar">
        <label className="search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search</span>
          <input className="input" placeholder={`Search ${cfg.title.toLowerCase()}`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {!cfg.noActiveFilter && (
          <select className="input" aria-label="Visibility" value={f.is_active} onChange={(e) => setF({ is_active: e.target.value })}>
            <option value="">Active & hidden</option><option value="true">Active only</option><option value="false">Hidden only</option>
          </select>
        )}
        {(cfg.filters ?? []).map((flt) => (
          <select key={flt.key} className="input" aria-label={flt.label} value={f[flt.key]} onChange={(e) => setF({ [flt.key]: e.target.value })}>
            <option value="">All {flt.label.toLowerCase()}</option>
            {flt.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {!cfg.noTrash && cfg.can.restore && (
          <label className="toggle"><input type="checkbox" checked={trashed} onChange={(e) => setF({ trashed: e.target.checked ? "true" : "" })} /> <Trash2 size={13} /> Trash</label>
        )}
      </div>

      <section className="panel panel--flush">
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRowClick={trashed ? undefined : (r) => open(r)} empty={trashed ? "Trash is empty" : `No ${cfg.title.toLowerCase()} yet`} />
        <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} />
      </section>

      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} wide={cfg.gallery} title={isEdit ? `Edit ${cfg.singular}` : `New ${cfg.singular}`}
        footer={<>
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>{saving && <Spinner />} {isEdit ? "Save changes" : `Create ${cfg.singular}`}</button>
        </>}
      >
        {editing && (
          <>
            <ResourceForm fields={cfg.fields} values={values} onChange={setValues} errors={errors} record={isEdit ? editing : null} />
            {cfg.gallery && isEdit && <FortGallery fortId={editing.id} />}
            {cfg.gallery && !isEdit && <p className="muted">Save the fort first to add gallery photos.</p>}
          </>
        )}
      </Drawer>
    </>
  );
}
