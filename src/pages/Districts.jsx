import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, PageHeader, Pagination } from "../components/ui.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { fmtNumber } from "../lib/format.js";

const DISTRICT_LIMIT = 10;

export default function Districts() {
  const navigate   = useNavigate();
  const [page, setPage] = useState(1);

  const { data, loading, error } = useFetch("/admin/stats/districts", { page, limit: DISTRICT_LIMIT });
  const raw        = data?.data;
  const rows       = raw?.items ?? [];
  const meta       = raw?.meta  ?? null;
  const totalRows  = meta?.total      ?? rows.length;
  const totalPages = meta?.totalPages ?? 1;

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const max        = Math.max(1, ...rows.map((r) => r.total));

  const columns = [
    {
      key: "rank",
      label: "#",
      width: 48,
      render: (r, i) => (page - 1) * DISTRICT_LIMIT + (i ?? rows.indexOf(r)) + 1,
    },
    {
      key: "district",
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
            <span style={{ width: `${(r.total / max) * 100}%` }} />
          </span>
          <small>{grandTotal ? ((r.total / grandTotal) * 100).toFixed(1) : "0.0"}%</small>
        </div>
      ),
    },
    { key: "total",    label: "Registrations", render: (r) => <strong>{fmtNumber(r.total)}</strong> },
    { key: "verified", label: "Verified",      render: (r) => <span style={{ color: "var(--success)" }}>{fmtNumber(r.verified)}</span> },
    { key: "pending",  label: "Pending",       render: (r) => <span style={{ color: "var(--warning)" }}>{fmtNumber(r.pending)}</span> },
    { key: "rejected", label: "Rejected",      render: (r) => <span style={{ color: "var(--danger)" }}>{fmtNumber(r.rejected)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="District statistics"
        crumbs={["Participation"]}
        subtitle={
          totalRows
            ? `${fmtNumber(totalRows)} districts · click a row to view its registrations`
            : "District-wise registration breakdown"
        }
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
          startIndex={(page - 1) * DISTRICT_LIMIT}
        />
        {(totalRows > 0 || page > 1) && (
          <Pagination
            meta={{ page, totalPages, total: totalRows, limit: DISTRICT_LIMIT }}
            onPage={setPage}
          />
        )}
      </section>
    </>
  );
}
