import { AlertTriangle, Award, CalendarDays, Clock, Images, Inbox, Map, ShieldCheck, Users, Video, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart, HBarList, PageHeader, StatCard } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { fmtNumber, PARTICIPANT_TYPES, timeAgo } from "../lib/format.js";

export default function Dashboard() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch("/admin/stats/dashboard");
  const d = data?.data;
  const t = d?.totals ?? {};

  return (
    <>
      <PageHeader
        title={`Welcome, ${admin.name.split(" ")[0]}`}
        subtitle="Live overview of Durgotsav 2026 participation."
        actions={<Link to="/moderation" className="btn btn--primary"><ShieldCheck size={16} /> Review photos {t.pending ? `(${fmtNumber(t.pending)})` : ""}</Link>}
      />
      {error && <div className="alert alert--error">{error.message}</div>}

      {t.pending_duplicates > 0 && (
        <div className="alert alert--warning">
          <AlertTriangle size={16} /> {fmtNumber(t.pending_duplicates)} pending registration(s) reuse a photo already submitted.
          <Link to="/registrations?status=pending&duplicates=true">Review duplicates →</Link>
        </div>
      )}

      <section className="stat-grid" aria-busy={loading}>
        <StatCard label="Total registrations" value={t.registrations} icon={Users} hint={`${fmtNumber(t.today)} today`} onClick={() => navigate("/registrations")} />
        <StatCard label="Awaiting review" value={(t.pending ?? 0) + (t.info_requested ?? 0)} icon={Clock} tone="warning" hint={`${fmtNumber(t.info_requested)} waiting on participant`} onClick={() => navigate("/moderation")} />
        <StatCard label="Verified participants" value={t.verified} icon={ShieldCheck} tone="success" onClick={() => navigate("/registrations?status=verified")} />
        <StatCard label="Certificates issued" value={t.certificates} icon={Award} tone="gold" hint={`${fmtNumber(t.certificates_emailed)} emailed`} onClick={() => navigate("/certificates")} />
        <StatCard label="Rejected" value={t.rejected} icon={XCircle} tone="danger" onClick={() => navigate("/registrations?status=rejected")} />
        <StatCard label="Gallery photos" value={t.gallery_photos} icon={Images} onClick={() => navigate("/registrations?featured=true")} />
        <StatCard label="Forts" value={t.forts} icon={Map} onClick={() => navigate("/content/forts")} />
        <StatCard label="New enquiries" value={t.new_enquiries} icon={Inbox} tone={t.new_enquiries ? "warning" : "brand"} onClick={() => navigate("/content/enquiries")} />
      </section>

      <div className="dash-grid">
        <section className="panel panel--span2">
          <header className="panel__head"><h2>Registrations · last 30 days</h2></header>
          {d ? <BarChart data={d.daily} label="Registrations per day for the last 30 days" /> : <div className="skeleton" style={{ height: 180 }} />}
        </section>
        <section className="panel">
          <header className="panel__head"><h2>By participant type</h2></header>
          {d && (d.by_type.length ? <HBarList items={d.by_type.map((x) => ({ name: PARTICIPANT_TYPES[x.type] ?? x.type, count: x.count }))} /> : <p className="muted">No data yet</p>)}
        </section>
        <section className="panel">
          <header className="panel__head"><h2>Top districts</h2><Link to="/districts">All →</Link></header>
          {d && <HBarList items={d.by_district.filter((x) => x.total > 0).map((x) => ({ name: x.district, count: x.total }))} />}
        </section>
        <section className="panel">
          <header className="panel__head"><h2>Replicas by fort</h2></header>
          {d && <HBarList items={d.by_fort} limit={12} />}
        </section>
        <section className="panel">
          <header className="panel__head"><h2>Recent activity</h2><Link to="/audit-logs">Audit log →</Link></header>
          <ul className="activity">
            {d?.recent_activity.map((a) => (
              <li key={a.id}>
                <span className="activity__dot" aria-hidden="true" />
                <span><strong>{a.admin_name ?? "System"}</strong> {a.action.replace(/_/g, " ")} {a.entity}{a.entity_id ? ` #${a.entity_id}` : ""}</span>
                <time dateTime={a.created_at}>{timeAgo(a.created_at)}</time>
              </li>
            ))}
            {d && !d.recent_activity.length && <li className="muted">No activity yet</li>}
          </ul>
        </section>
        <section className="panel panel--quick">
          <header className="panel__head"><h2>Content</h2></header>
          <div className="quick-links">
            <Link to="/content/events"><CalendarDays size={16} /> {fmtNumber(t.events)} timeline items</Link>
            <Link to="/content/videos"><Video size={16} /> {fmtNumber(t.videos)} videos</Link>
            <Link to="/content/announcements">Announcements</Link>
            <Link to="/settings">Registration window & settings</Link>
          </div>
        </section>
      </div>
    </>
  );
}
