import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { api, apiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { Spinner, DataTable, Drawer, Field, PageHeader } from "../components/ui.jsx";
import { PermissionMatrix } from "../components/PermissionMatrix.jsx";

const EMPTY_ROLE = { name: "", slug: "", description: "", permissions: {}, is_admin: false };

export default function Roles() {
  const { admin: me, refresh } = useAuth();
  const { toast, confirm } = useUi();
  const [roles, setRoles]         = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [drawer, setDrawer]       = useState(null);   // null | { mode: "create"|"edit", role }
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState(null);
  const [form, setForm]           = useState(EMPTY_ROLE);
  const [sort, setSort]           = useState({ sort: "", dir: "" });
  const nameRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        api.get("/admin/rbac", { params: sort.sort ? sort : {} }),
        api.get("/admin/rbac/catalogue"),
      ]);
      setRoles(r.data.data);
      setCatalogue(c.data.data);
      setError(null);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({ ...EMPTY_ROLE });
    setSaveErr(null);
    setDrawer({ mode: "create" });
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function openEdit(role) {
    setForm({
      name: role.name,
      slug: role.slug,
      description: role.description ?? "",
      permissions: role.permissions ?? {},
      is_admin: role.is_admin,
    });
    setSaveErr(null);
    setDrawer({ mode: "edit", role });
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function closeDrawer() { setDrawer(null); }

  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function handleNameChange(e) {
    const v = e.target.value;
    setForm((f) => ({ ...f, name: v, slug: drawer?.mode === "create" ? slugify(v) : f.slug }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveErr(null);
    try {
      if (drawer.mode === "create") {
        await api.post("/admin/rbac", {
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          description: form.description.trim() || undefined,
          permissions: form.permissions,
          is_admin: form.is_admin,
        });
      } else {
        await api.put(`/admin/rbac/${drawer.role.id}`, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          permissions: form.permissions,
          is_admin: form.is_admin,
        });
      }
      toast(drawer.mode === "create" ? "Role created successfully" : "Role saved successfully");
      closeDrawer();
      load();
      refresh();
    } catch (e) {
      setSaveErr(apiError(e).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role) {
    if (!(await confirm({ title: `Delete "${role.name}"?`, message: "This cannot be undone.", confirmLabel: "Delete", tone: "danger" }))) return;
    try {
      await api.delete(`/admin/rbac/${role.id}`);
      toast("Role deleted");
      load();
    } catch (e) {
      toast(apiError(e).message, "error");
    }
  }

  const cols = [
    {
      key: "name",
      sortKey: "name",
      label: "Role",
      render: (r) => (
        <span>
          <strong>{r.name}</strong>
          {r.is_system && <span className="badge badge--neutral" style={{ marginLeft: 6 }}>Built-in</span>}
          {r.is_admin  && <span className="badge badge--brand"   style={{ marginLeft: 6 }}>Full access</span>}
          {r.description && <small className="text-muted" style={{ display: "block" }}>{r.description}</small>}
        </span>
      ),
    },
    { key: "slug",       sortKey: "slug",                          label: "Slug",   render: (r) => <code>{r.slug}</code> },
    { key: "user_count", sortKey: "user_count", sortFirst: "desc", label: "Users",  render: (r) => r.user_count },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <span className="row-actions">
          <button className="icon-btn icon-btn--edit" title="Edit" onClick={() => openEdit(r)}>
            <Edit2 size={15} />
          </button>
          {!r.is_system && (
            <button
              className="icon-btn icon-btn--danger"
              title={r.user_count > 0 ? "Role in use" : "Delete"}
              disabled={r.user_count > 0}
              onClick={() => handleDelete(r)}
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
        title="Roles & Permissions"
        crumbs={["System"]}
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Plus size={16} /> New role
          </button>
        }
      />

      {error ? (
        <div className="alert alert--error">{error}</div>
      ) : (
        <section className="panel panel--flush">
          <DataTable columns={cols} rows={roles} loading={loading} empty="No roles yet" startIndex={0} total={roles.length}
            sort={{ key: sort.sort, dir: sort.dir, onSort: setSort, clearable: true }} />
        </section>
      )}

      {/* ---- drawer ---- */}
      <Drawer
        open={Boolean(drawer)}
        onClose={closeDrawer}
        wide
        title={drawer?.mode === "create" ? "New role" : `Edit "${drawer?.role?.name ?? ""}"`}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeDrawer} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="role-form" className="btn btn--primary" disabled={saving}>
              {saving ? <Spinner size={14} /> : "Save role"}
            </button>
          </>
        }
      >
        {drawer && (
          <form id="role-form" className="form-grid" onSubmit={handleSave}>
            {drawer.role?.is_system && (
              <div className="alert alert--info form-grid__full">
                This is a built-in role. You can edit its permissions but cannot delete it.
              </div>
            )}
            {me?.role_id === drawer.role?.id && (
              <div className="alert alert--warning form-grid__full">
                You are editing your own role. Changes take effect on your next request.
              </div>
            )}

            <div className={drawer.mode === "create" ? "form-grid__half" : "form-grid__full"}>
              <Field label="Role name" required>
                {(p) => (
                  <input {...p} ref={nameRef} className="input" value={form.name}
                    onChange={handleNameChange} required maxLength={100} />
                )}
              </Field>
            </div>

            {drawer.mode === "create" && (
              <div className="form-grid__half">
                <Field label="Slug" hint="Auto-generated from the name">
                  {(p) => (
                    <input {...p} className="input" value={form.slug} maxLength={80}
                      placeholder="e.g. content_editor"
                      onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                  )}
                </Field>
              </div>
            )}

            <div className="form-grid__full">
              <Field label="Description">
                {(p) => (
                  <textarea {...p} className="input" rows={3} maxLength={500}
                    placeholder="What can people with this role do?"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                )}
              </Field>
            </div>

            <label className="form-grid__full switch">
              <input type="checkbox" checked={form.is_admin}
                onChange={(e) => setForm((f) => ({ ...f, is_admin: e.target.checked }))} />
              <span className="switch__track" aria-hidden="true" />
              Full access — bypasses all permission checks
              {form.is_admin && <span className="badge badge--brand">Super admin</span>}
            </label>

            <div className="form-grid__full field">
              <span className="label">Permissions</span>
              <PermissionMatrix
                catalogue={catalogue}
                value={form.permissions}
                onChange={(p) => setForm((f) => ({ ...f, permissions: p }))}
                disabled={form.is_admin}
              />
            </div>

            {saveErr && <div className="alert alert--error form-grid__full">{saveErr}</div>}
          </form>
        )}
      </Drawer>
    </div>
  );
}
