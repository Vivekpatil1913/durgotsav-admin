import { useNavigate } from "react-router-dom";
import { DataTable, PageHeader } from "../components/ui.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { fmtNumber } from "../lib/format.js";

export default function Districts() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch("/admin/stats/districts");
  const rows = data?.data ?? [];
  const total = rows.reduce((s, r) => s + r.total, 0);
  const max = Math.max(1, ...rows.map((r) => r.total));

  const columns = [
    { key: "rank", label: "#", width: 48, render: (r) => rows.indexOf(r) + 1 },
    { key: "district", label: "District", render: (r) => <div className="cell-stack"><strong className="mr">{r.district}</strong><small>{r.name_en}</small></div> },
    { key: "bar", label: "Share", render: (r) => (
      <div className="share">
        <span className="share__track"><span style={{ width: `${(r.total / max) * 100}%` }} /></span>
        <small>{total ? ((r.total / total) * 100).toFixed(1) : "0.0"}%</small>
      </div>
    ) },
    { key: "total", label: "Total", render: (r) => <strong>{fmtNumber(r.total)}</strong> },
    { key: "verified", label: "Verified", render: (r) => fmtNumber(r.verified) },
    { key: "pending", label: "Pending", render: (r) => fmtNumber(r.pending) },
    { key: "rejected", label: "Rejected", render: (r) => fmtNumber(r.rejected) },
  ];
  return (
    <>
      <PageHeader title="District statistics" crumbs={["Participation"]} subtitle={`${fmtNumber(total)} registrations from Maharashtra districts. Click a district to see its registrations.`} />
      <section className="panel panel--flush">
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRowClick={(r) => navigate(`/registrations?district_id=${r.id}`)} />
      </section>
    </>
  );
}
