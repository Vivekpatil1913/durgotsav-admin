import { DataTable, PageHeader, Pagination } from "../components/ui.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { clean, useLastPage, useQueryState } from "../hooks/useQueryState.js";
import { fmtNumber } from "../lib/format.js";

const CITY_LIMIT = 10;

export default function CityStats() {
  const [f, setF] = useQueryState({ district: "", sort: "registrations", dir: "desc", page: "1" });

  const { data, loading, error } = useFetch("/admin/stats/cities", clean({ ...f, limit: CITY_LIMIT }));
  const { data: distData }       = useFetch("/admin/stats/districts", { limit: 50 });

  const raw        = data?.data;
  const rows       = raw?.items ?? [];
  const meta       = raw?.meta  ?? null;
  const total      = meta?.total      ?? rows.length;
  useLastPage(meta, (p) => setF({ page: String(p) }));

  const districtList = distData?.data?.items ?? [];

  const columns = [
    {
      key: "city",
      sortKey: "city",
      label: "City / Taluka",
      render: (r) => <div className="cell-stack"><strong>{r.city || "—"}</strong></div>,
    },
    {
      key: "district",
      sortKey: "district",
      label: "District",
      render: (r) => <div className="cell-stack"><strong className="mr">{r.district || "—"}</strong><small>{r.district_en || ""}</small></div>,
    },
    {
      key: "registrations",
      sortKey: "registrations",
      sortFirst: "desc",
      label: "Registrations",
      render: (r) => <strong>{fmtNumber(r.registrations)}</strong>,
    },
    {
      key: "uploaded",
      sortKey: "uploaded",
      sortFirst: "desc",
      label: "Uploaded",
      render: (r) => fmtNumber(r.uploaded),
    },
    {
      key: "verified",
      sortKey: "verified",
      sortFirst: "desc",
      label: "Verified",
      render: (r) => <span style={{ color: "var(--success)" }}>{fmtNumber(r.verified)}</span>,
    },
    {
      key: "pending",
      sortKey: "pending",
      sortFirst: "desc",
      label: "Pending",
      render: (r) => <span style={{ color: "var(--warning)" }}>{fmtNumber(r.pending)}</span>,
    },
    {
      key: "rejected",
      sortKey: "rejected",
      sortFirst: "desc",
      label: "Rejected",
      render: (r) => <span style={{ color: "var(--danger)" }}>{fmtNumber(r.rejected)}</span>,
    },
    {
      key: "certificates",
      sortKey: "certificates",
      sortFirst: "desc",
      label: "Certificates",
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
            value={f.district}
            onChange={(e) => setF({ district: e.target.value })}
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
          meta={meta}
          sort={{ key: f.sort, dir: f.dir, onSort: setF }}
        />
        {total > 0 && <Pagination meta={meta} onPage={(p) => setF({ page: String(p) })} />}
      </section>
    </>
  );
}
