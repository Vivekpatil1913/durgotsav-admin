// Permission matrix UI — renders a grouped checkbox table for assigning module
// permissions to a role. Mirrors the Sumago admin panel design.
//
// Props:
//   catalogue  – array of { key, label, group, supportsWrite, supportsDelete }
//                from GET /api/admin/rbac/catalogue
//   value      – current permissions map { moduleKey: { read, write, delete } }
//   onChange   – called with the new permissions map
//   disabled   – greys out all checkboxes (used when role.is_admin = true)

export function PermissionMatrix({ catalogue = [], value = {}, onChange, disabled = false }) {
  // Group modules
  const groups = catalogue.reduce((acc, m) => {
    (acc[m.group] ??= []).push(m);
    return acc;
  }, {});

  function getLevel(key, level) {
    const mp = value[key] ?? {};
    if (level === "read")   return Boolean(mp.read || mp.write || mp.delete);
    if (level === "write")  return Boolean(mp.write || mp.delete);
    if (level === "delete") return Boolean(mp.delete);
    return false;
  }

  function setLevel(key, level, checked) {
    const next = { ...value };
    const mp   = { ...(next[key] ?? {}) };

    if (level === "read") {
      mp.read = checked;
      if (!checked) { mp.write = false; mp.delete = false; }  // untick write/delete too
    }
    if (level === "write") {
      mp.write = checked;
      if (checked)  mp.read   = true;    // write implies read
      if (!checked) mp.delete = false;   // un-checking write removes delete too
    }
    if (level === "delete") {
      mp.delete = checked;
      if (checked) { mp.read = true; mp.write = true; }
    }

    // Clean up empty entries
    if (!mp.read && !mp.write && !mp.delete) {
      delete next[key];
    } else {
      next[key] = mp;
    }
    onChange(next);
  }

  function applicable(modules, level) {
    return modules.filter((m) =>
      !(level === "write" && !m.supportsWrite) && !(level === "delete" && !m.supportsDelete));
  }

  // A level with no applicable modules (e.g. Dashboard has no edit) is never "all checked".
  function allChecked(modules, level) {
    const mods = applicable(modules, level);
    return mods.length > 0 && mods.every((m) => getLevel(m.key, level));
  }

  function toggleAll(modules, level, checked) {
    const next = { ...value };
    for (const m of modules) {
      if (level === "write" && !m.supportsWrite) continue;
      if (level === "delete" && !m.supportsDelete) continue;
      const mp = { ...(next[m.key] ?? {}) };
      if (level === "read") {
        mp.read = checked;
        if (!checked) { mp.write = false; mp.delete = false; }
      }
      if (level === "write") {
        mp.write = checked;
        if (checked) mp.read = true;
        if (!checked) mp.delete = false;
      }
      if (level === "delete") {
        mp.delete = checked;
        if (checked) { mp.read = true; mp.write = true; }
      }
      if (!mp.read && !mp.write && !mp.delete) delete next[m.key];
      else next[m.key] = mp;
    }
    onChange(next);
  }

  return (
    <div className="pm-wrap">
      {Object.entries(groups).map(([groupName, modules]) => (
        <div key={groupName} className="pm-group">
          <div className="pm-group-header">
            <span className="pm-group-name">{groupName}</span>
            <span className="pm-col-label">View</span>
            <span className="pm-col-label">Edit</span>
            <span className="pm-col-label">Delete</span>
          </div>

          {/* Bulk row */}
          <div className="pm-row pm-row--bulk">
            <span className="pm-module-label pm-module-label--all">All {groupName}</span>
            {(["read", "write", "delete"]).map((lvl) => (
              <label key={lvl} className={`pm-cell${applicable(modules, lvl).length ? "" : " pm-cell--na"}`}>
                <input
                  type="checkbox"
                  disabled={disabled || !applicable(modules, lvl).length}
                  checked={!disabled && allChecked(modules, lvl)}
                  onChange={(e) => toggleAll(modules, lvl, e.target.checked)}
                />
              </label>
            ))}
          </div>

          {modules.map((m) => {
            // alwaysEditable modules (e.g. moderation_bulk) stay interactive even on is_admin roles
            const isDisabled = disabled && !m.alwaysEditable;
            return (
              <div key={m.key} className={`pm-row${m.alwaysEditable ? " pm-row--explicit" : ""}`}>
                <span className="pm-module-label">
                  {m.label}
                  {m.alwaysEditable && <span className="pm-explicit-badge">explicit</span>}
                </span>

                {/* View */}
                <label className="pm-cell" title="View (read)">
                  <input
                    type="checkbox"
                    disabled={isDisabled}
                    checked={!isDisabled && getLevel(m.key, "read")}
                    onChange={(e) => setLevel(m.key, "read", e.target.checked)}
                  />
                </label>

                {/* Edit */}
                <label className={`pm-cell${!m.supportsWrite ? " pm-cell--na" : ""}`} title={m.supportsWrite ? "Edit (write)" : "Not applicable"}>
                  <input
                    type="checkbox"
                    disabled={isDisabled || !m.supportsWrite}
                    checked={!isDisabled && m.supportsWrite && getLevel(m.key, "write")}
                    onChange={(e) => setLevel(m.key, "write", e.target.checked)}
                  />
                </label>

                {/* Delete */}
                <label className={`pm-cell${!m.supportsDelete ? " pm-cell--na" : ""}`} title={m.supportsDelete ? "Delete" : "Not applicable"}>
                  <input
                    type="checkbox"
                    disabled={isDisabled || !m.supportsDelete}
                    checked={!isDisabled && m.supportsDelete && getLevel(m.key, "delete")}
                    onChange={(e) => setLevel(m.key, "delete", e.target.checked)}
                  />
                </label>
              </div>
            );
          })}
        </div>
      ))}

      {disabled && (
        <p className="pm-admin-note">
          This role has <strong>full access</strong> and bypasses all permission checks.
        </p>
      )}
    </div>
  );
}
