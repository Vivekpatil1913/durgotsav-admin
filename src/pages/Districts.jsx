import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, PageHeader, Pagination } from "../components/ui.jsx";
import { EDITION_YEAR } from "../config/edition.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { useLastPage, useQueryState } from "../hooks/useQueryState.js";
import { apiError, downloadFile } from "../lib/api.js";
import { fmtNumber } from "../lib/format.js";

const DISTRICT_LIMIT = 10;

export default function Districts() {
  const navigate   = useNavigate();
  const { toast } = useUi();
  const { hasPermission } = useAuth();
  const [f, setF] = useQueryState({ sort: "total", dir: "desc", page: "1" });
  const [exporting, setExporting] = useState(null);

  const { data, loading, error } = useFetch("/admin/stats/districts", { ...f, limit: DISTRICT_LIMIT });
  const raw        = data?.data;
  const rows       = raw?.items ?? [];
  const meta       = raw?.meta  ?? null;
  // Totals of every district the admin can see (not just this page), counted on the server
  const summary    = raw?.summary ?? null;
  useLastPage(meta, (p) => setF({ page: String(p) }));

  const columns = [
    {
      key: "district",
      sortKey: "district",
      label: "District",
      render: (r) => (
        <div className="cell-stack">
          <strong className="mr">{r.district}</strong>
          <small>{r.name_en}</small>
        </div>
      ),
    },
    {
      key: "bar",
      label: "Share",
      render: (r) => (
        <div className="share">
          <span className="share__track">
            <span style={{ width: `${r.share ?? 0}%` }} />
          </span>
          <small>{(r.share ?? 0).toFixed(1)}%</small>
        </div>
      ),
    },
    { key: "total",     sortKey: "total",     sortFirst: "desc", label: "Registrations", render: (r) => <strong>{fmtNumber(r.total)}</strong> },
    { key: "verified",  sortKey: "verified",  sortFirst: "desc", label: "Verified",      render: (r) => <span style={{ color: "var(--success)" }}>{fmtNumber(r.verified)}</span> },
    { key: "pending",   sortKey: "pending",   sortFirst: "desc", label: "Pending",       render: (r) => <span style={{ color: "var(--warning)" }}>{fmtNumber(r.pending)}</span> },
    { key: "rejected",  sortKey: "rejected",  sortFirst: "desc", label: "Rejected",      render: (r) => <span style={{ color: "var(--danger)" }}>{fmtNumber(r.rejected)}</span> },
    { key: "duplicate", sortKey: "duplicate", sortFirst: "desc", label: "Duplicate",     render: (r) => <span className="muted">{fmtNumber(r.duplicate)}</span> },
  ];

  async function exportAs(format) {
    setExporting(format);
    try {
      await downloadFile(`/admin/stats/districts/export.${format}`, null, `durgotsav-${EDITION_YEAR}-district-stats.${format}`);
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setExporting(null);
    }
  }

  const subtitle = summary
    ? [
        `${fmtNumber(summary.districts)} districts`,
        `${fmtNumber(summary.total)} registrations`,
        summary.no_district > 0 && `${fmtNumber(summary.no_district)} outside Maharashtra (no district)`,
        "click a row to view its registrations",
      ].filter(Boolean).join(" · ")
    : "District-wise registration breakdown";

  return (
    <>
      <PageHeader
        title="District statistics"
        crumbs={["Participation"]}
        subtitle={subtitle}
        actions={hasPermission("reports", "write") && (
          <div className="cluster cluster--tight">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => exportAs("xlsx")} disabled={Boolean(exporting)}>
              <FileSpreadsheet size={15} /> {exporting === "xlsx" ? "Exporting…" : "Excel"}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => exportAs("csv")} disabled={Boolean(exporting)}>
              <Download size={15} /> {exporting === "csv" ? "Exporting…" : "CSV"}
            </button>
          </div>
        )}
      />
      {error && <div className="alert alert--error">{error.message}</div>}
      <section className="panel panel--flush">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          empty="No district data available yet"
          onRowClick={(r) => navigate(`/registrations?district_id=${r.id}`)}
          rowKey={(r) => r.id ?? r.district}
          meta={meta}
          sort={{ key: f.sort, dir: f.dir, onSort: setF }}
        />
        {meta?.total > 0 && <Pagination meta={meta} onPage={(p) => setF({ page: String(p) })} />}
      </section>
    </>
  );
}
