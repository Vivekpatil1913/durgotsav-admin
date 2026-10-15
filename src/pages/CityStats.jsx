import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { DataTable, PageHeader, Pagination } from "../components/ui.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { fmtNumber } from "../lib/format.js";

const CITY_LIMIT = 10;

const SORT_COLS = ["city", "registrations", "uploaded", "verified", "pending", "rejected", "certificates"];

export default function CityStats() {
  const [page,     setPage]     = useState(1);
  const [district, setDistrict] = useState("");
  const [sortKey,  setSortKey]  = useState("registrations");
  const [sortDir,  setSortDir]  = useState("desc");

  const params = {
    page,
    limit: CITY_LIMIT,
    sort: sortKey,
    dir: sortDir,
    ...(district ? { district } : {}),
  };

  const { data, loading, error } = useFetch("/admin/stats/cities", params);
  const { data: distData }       = useFetch("/admin/stats/districts", { limit: 50 });

  const raw        = data?.data;
  const rows       = raw?.items ?? [];
  const meta       = raw?.meta  ?? null;
  const total      = meta?.total      ?? rows.length;
  const totalPages = meta?.totalPages ?? 1;

  const districtList = distData?.data?.items ?? [];

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); setPage(1); }
  }

  function ThSort({ col, label }) {
    const active = sortKey === col;
    const Icon   = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <button
        type="button"
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          background: "none", border: "none", padding: 0,
          font: "inherit", fontWeight: 600, fontSize: "inherit",
          cursor: "pointer", color: active ? "var(--brand)" : "inherit",
          letterSpacing: "0.04em", textTransform: "uppercase",
        }}
        onClick={() => toggleSort(col)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label} <Icon size={11} />
      </button>
    );
  }

  const columns = [
    {
      key: "city",
      label: SORT_COLS.includes("city") ? <ThSort col="city" label="City / Taluka" /> : "City / Taluka",
      render: (r) => <div className="cell-stack"><strong>{r.city || "—"}</strong></div>,
    },
    {
      key: "district",
      label: "District",
      render: (r) => <div className="cell-stack"><strong className="mr">{r.district || "—"}</strong><small>{r.district_en || ""}</small></div>,
    },
    {
      key: "registrations",
      label: <ThSort col="registrations" label="Registrations" />,
      render: (r) => <strong>{fmtNumber(r.registrations)}</strong>,
    },
    {
      key: "uploaded",
      label: <ThSort col="uploaded" label="Uploaded" />,
      render: (r) => fmtNumber(r.uploaded),
    },
    {
      key: "verified",
      label: <ThSort col="verified" label="Verified" />,
      render: (r) => <span style={{ color: "var(--success)" }}>{fmtNumber(r.verified)}</span>,
    },
    {
      key: "pending",
      label: "Pending",
      render: (r) => <span style={{ color: "var(--warning)" }}>{fmtNumber(r.pending)}</span>,
    },
    {
      key: "rejected",
      label: "Rejected",
      render: (r) => <span style={{ color: "var(--danger)" }}>{fmtNumber(r.rejected)}</span>,
    },
    {
      key: "certificates",
      label: <ThSort col="certificates" label="Certificates" />,
      render: (r) => fmtNumber(r.certificates),
    },
  ];

  return (
    <>
      <PageHeader
        title="City-wise statistics"
        crumbs={["Participation"]}
        subtitle={
          total
            ? `${fmtNumber(total)} cities / talukas across Maharashtra`
            : "City and taluka breakdown of registrations"
        }
        actions={
          <select
            className="input input--sm"
            style={{ width: "auto", minWidth: 190 }}
            value={district}
            onChange={(e) => { setDistrict(e.target.value); setPage(1); }}
            aria-label="Filter by district"
          >
            <option value="">All districts</option>
            {districtList.map((d) => (
              <option key={d.id ?? d.district} value={d.district}>
                {d.district}{d.name_en ? ` (${d.name_en})` : ""}
              </option>
            ))}
          </select>
        }
      />
      {error && <div className="alert alert--error">{error.message}</div>}
      <section className="panel panel--flush">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          empty="No city data available"
          rowKey={(r) => `${r.district_id ?? ""}__${r.city ?? ""}`}
          startIndex={(page - 1) * CITY_LIMIT}
        />
        {(total > 0 || page > 1) && (
          <Pagination
            meta={{ page, totalPages, total, limit: CITY_LIMIT }}
            onPage={setPage}
          />
        )}
      </section>
    </>
  );
}
