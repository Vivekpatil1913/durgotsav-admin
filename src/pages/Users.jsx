import { useCallback, useEffect, useRef, useState } from "react";
import { Edit2, MapPin, Plus, Search, Trash2, RotateCcw } from "lucide-react";
import { api, apiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { Spinner, DataTable, Drawer, Field, PageHeader } from "../components/ui.jsx";

const EMPTY_FORM = {
  name: "", email: "", role_id: "", password: "", is_active: true, division_ids: [],
};

export default function Users() {
  const { admin: me } = useAuth();
  const { toast, confirm } = useUi();
  const [admins,    setAdmins]    = useState([]);
  const [roles,     setRoles]     = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [meta,      setMeta]      = useState({ total: 0, page: 1 });
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [query,     setQuery]     = useState("");
  const [trashed,   setTrashed]   = useState(false);
  const [drawer,    setDrawer]    = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [saveErr,   setSaveErr]   = useState(null);
  const nameRef = useRef(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 25, trashed: trashed ? "true" : "false" };
      if (query) params.q = query;
      const r = await api.get("/admin/admins", { params });
      setAdmins(r.data.data);
      setMeta(r.data.meta);
      setError(null);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [query, trashed]);

  // Load roles + divisions once
  useEffect(() => {
    Promise.all([
      api.get("/admin/rbac"),
      api.get("/admin/lookups"),
    ]).then(([r, l]) => {
      setRoles(r.data.data);
      setDivisions(l.data.data.divisions ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openEdit(admin) {
    // Fetch full admin with divisions
    const r = await api.get(`/admin/admins/${admin.id}`).catch(() => ({ data: { data: admin } }));
    const full = r.data.data;
    setForm({
      name:         full.name,
      email:        full.email,
      role_id:      full.role_id,
      password:     "",
      is_active:    full.is_active,
      division_ids: (full.divisions ?? []).map((d) => d.division_id),
    });
    setSaveErr(null);
    setDrawer({ mode: "edit", admin: full });
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setSaveErr(null);
    setDrawer({ mode: "create" });
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function closeDrawer() { setDrawer(null); }

  const selectedRole = roles.find((r) => r.id === Number(form.role_id));
  const isSelf       = drawer?.mode === "edit" && drawer.admin.id === me?.id;
  const needsDivisions = selectedRole && !selectedRole.is_admin;

  function toggleDivision(id) {
    setForm((f) => ({
      ...f,
      division_ids: f.division_ids.includes(id)
        ? f.division_ids.filter((d) => d !== id)
        : [...f.division_ids, id],
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const payload = {
        name:         form.name.trim(),
        email:        form.email.trim().toLowerCase(),
        role_id:      Number(form.role_id),
        is_active:    form.is_active,
        division_ids: needsDivisions ? form.division_ids : [],
      };
      if (form.password) payload.password = form.password;
      if (drawer.mode === "create") {
        await api.post("/admin/admins", payload);
      } else {
        // For self: never send role_id (server blocks it anyway)
        if (isSelf) delete payload.role_id;
        await api.put(`/admin/admins/${drawer.admin.id}`, payload);
      }
      toast(drawer.mode === "create" ? "Admin user created" : "Changes saved successfully");
      closeDrawer();
      load();
    } catch (e) {
      const err = apiError(e);
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(admin) {
    if (!(await confirm({ title: `Delete "${admin.name}"?`, message: "This cannot be undone.", confirmLabel: "Delete", tone: "danger" }))) return;
    try {
      await api.delete(`/admin/admins/${admin.id}`);
      toast("Admin user deleted");
      load();
    } catch (e) {
      toast(apiError(e).message, "error");
    }
  }

  async function handleRestore(admin) {
    try {
      await api.post(`/admin/admins/${admin.id}/restore`);
      toast(`${admin.name} restored`);
      load();
    } catch (e) {
      toast(apiError(e).message, "error");
    }
  }

  const cols = [
    {
      key: "name",
      label: "Name",
      render: (a) => (
        <span>
          <strong>{a.name}</strong>
          <small className="text-muted" style={{ display: "block" }}>{a.email}</small>
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (a) => (
        <span>
          {a.role_name ?? a.role}
          {a.is_admin && <span className="badge badge--brand" style={{ marginLeft: 6 }}>Full access</span>}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (a) => (
        <span className={`badge ${a.is_active ? "badge--success" : "badge--neutral"}`}>
          {a.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (a) => new Date(a.created_at).toLocaleDateString("en-IN"),
    },
    {
      key: "actions",
      label: "",
      render: (a) => (
        <span className="row-actions">
          {!trashed && (
            <button className="icon-btn icon-btn--edit" title="Edit" onClick={() => openEdit(a)}>
              <Edit2 size={15} />
            </button>
          )}
          {trashed ? (
            <button className="icon-btn" title="Restore" onClick={() => handleRestore(a)}>
              <RotateCcw size={15} />
            </button>
          ) : (
            <button
              className="icon-btn icon-btn--danger"
              title={a.id === me?.id ? "Cannot delete own account" : "Delete"}
              disabled={a.id === me?.id}
              onClick={() => handleDelete(a)}
            >
              <Trash2 size={15} />
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Admin Users"
        crumbs={["System"]}
        actions={!trashed && (
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Plus size={16} /> New user
          </button>
        )}
      />

      <div className="resource-tabs">
        <button type="button" className={`resource-tab ${!trashed ? "is-active" : ""}`} onClick={() => setTrashed(false)}>
          Admin Users
        </button>
        <button type="button" className={`resource-tab ${trashed ? "is-active" : ""}`} onClick={() => setTrashed(true)}>
          <Trash2 size={13} /> Trash
        </button>
      </div>

      <div className="toolbar">
        <label className="search search--wide">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input
            className="input"
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <div className="alert alert--error">{error}</div>
      ) : (
        <section className="panel panel--flush">
          <DataTable
            columns={cols}
            rows={admins}
            loading={loading}
            empty={trashed ? "Trash is empty" : "No admin users yet"}
            startIndex={((meta.page ?? 1) - 1) * (meta.limit ?? 25)}
            total={meta.total}
          />
        </section>
      )}

      {/* ---- drawer ---- */}
      <Drawer
        open={Boolean(drawer)}
        onClose={closeDrawer}
        title={drawer?.mode === "create" ? "New admin user" : `Edit "${drawer?.admin?.name ?? ""}"`}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeDrawer} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="user-form" className="btn btn--primary" disabled={saving}>
              {saving ? <Spinner size={14} /> : (drawer?.mode === "create" ? "Create user" : "Save changes")}
            </button>
          </>
        }
      >
        {drawer && (
          <form id="user-form" className="form-grid" onSubmit={handleSave}>
            {isSelf && (
              <div className="alert alert--info form-grid__full">
                You are editing your own account. Role cannot be changed here.
              </div>
            )}

            <div className="form-grid__full">
              <Field label="Full name" required>
                {(p) => (
                  <input {...p} ref={nameRef} className="input" required maxLength={120}
                    value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                )}
              </Field>
            </div>

            <div className="form-grid__full">
              <Field label="Email" required>
                {(p) => (
                  <input {...p} className="input" type="email" required maxLength={160}
                    value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                )}
              </Field>
            </div>

            <div className="form-grid__full">
              <Field
                label={drawer.mode === "create" ? "Password" : "New password"}
                required={drawer.mode === "create"}
                hint={drawer.mode === "create" ? "Minimum 10 characters" : "Leave blank to keep the current password"}
              >
                {(p) => (
                  <input {...p} className="input" type="password" minLength={10} maxLength={128}
                    required={drawer.mode === "create"} autoComplete="new-password"
                    value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                )}
              </Field>
            </div>

            {!isSelf && (
              <div className="form-grid__full">
                <Field
                  label="Role"
                  required
                  hint={selectedRole?.is_admin ? "This role bypasses all permission checks." : undefined}
                >
                  {(p) => (
                    <select {...p} className="input" required value={form.role_id}
                      onChange={(e) => setForm((f) => ({ ...f, role_id: Number(e.target.value), division_ids: [] }))}>
                      <option value="">Select a role…</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}{r.is_admin ? " (Full access)" : ""}</option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            )}

            <label className="form-grid__full switch">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              <span className="switch__track" aria-hidden="true" />
              Active account
            </label>

            {/* Division access (only for non-admin roles) */}
            {needsDivisions && divisions.length > 0 && (
              <fieldset className="form-grid__full field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ marginBottom: 6 }}>
                  <MapPin size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Division access
                </legend>
                <div className="division-grid">
                  {divisions.map((d) => (
                    <label key={d.id} className="division-check">
                      <input
                        type="checkbox"
                        checked={form.division_ids.includes(d.id)}
                        onChange={() => toggleDivision(d.id)}
                      />
                      <div>
                        <span>{d.name_mr}</span>
                        <small>{d.name_en}</small>
                      </div>
                    </label>
                  ))}
                </div>
                <small className="field__hint">Leave all unchecked to grant no division access.</small>
              </fieldset>
            )}

            {saveErr && <div className="alert alert--error form-grid__full">{saveErr}</div>}
          </form>
        )}
      </Drawer>
    </div>
  );
}
