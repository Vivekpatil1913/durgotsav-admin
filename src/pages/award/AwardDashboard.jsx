import { Building2, CheckCircle2, ListChecks, User, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart, Badge, HBarList, PageHeader, StatCard } from "../../components/ui.jsx";
import { useFetch } from "../../hooks/useFetch.js";
import { AWARD_BASE, AWARD_SECTION, optionLabel } from "../../lib/award.js";
import { fmtDateTime } from "../../lib/format.js";

const WINDOW = {
  open: ["Nominations open", "success"],
  not_started: ["Not started yet", "info"],
  closed: ["Nominations closed", "danger"],
  disabled: ["Disabled by admin", "danger"],
};

// Server days are IST calendar dates ("YYYY-MM-DD")
const istDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const MIN_DAYS = 14;
const MAX_DAYS = 90;

/** One entry per calendar day across the nomination window (zero-filled), so a few busy days don't become full-width bars. */
function dailySeries(daily, window) {
  const today = istDay(Date.now());
  const first = daily[0]?.day;
  const last = daily[daily.length - 1]?.day;
  const max = (...d) => d.filter(Boolean).sort().pop();
  const min = (...d) => d.filter(Boolean).sort()[0];
  let start = min(first, window?.opensAt && istDay(window.opensAt), today);
  let end = max(last, window?.closesAt ? istDay(window.closesAt) : today);
  // A long window is cut to the latest MAX_DAYS that have happened; a short one is padded to MIN_DAYS
  if (addDays(start, MAX_DAYS - 1) < end) end = max(last, today);
  if (addDays(start, MAX_DAYS - 1) < end) start = addDays(end, -(MAX_DAYS - 1));
  if (addDays(start, MIN_DAYS - 1) > end) end = addDays(start, MIN_DAYS - 1);
  const counts = new Map(daily.map((d) => [d.day, d.count]));
  const out = [];
  for (let day = start; day <= end; day = addDays(day, 1)) out.push({ day, count: counts.get(day) ?? 0 });
  return out;
}

export default function AwardDashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch("/admin/shivdurg-award/stats");
  const options = useFetch("/admin/shivdurg-award/options").data?.data?.options;
  const s = data?.data;
  const t = s?.totals ?? {};
  const go = (q) => navigate(`${AWARD_BASE}/nominations${q ? `?${q}` : ""}`);
  const [wLabel, wTone] = WINDOW[s?.window?.reason] ?? ["…", "neutral"];

  return (
    <>
      <PageHeader
        title="Award dashboard"
        crumbs={[AWARD_SECTION]}
        subtitle={s ? <span className="mr">{s.edition.title}</span> : "Nomination statistics from the database"}
        actions={s && (
          <div className="cluster cluster--tight">
            <Badge tone={wTone}>{wLabel}</Badge>
            <small className="muted">{fmtDateTime(s.window.opensAt)} → {fmtDateTime(s.window.closesAt)}</small>
          </div>
        )}
      />
      {error && <div className="alert alert--error">{error.message}</div>}
      <section className="stat-grid" aria-busy={loading}>
        <StatCard label="Total nominations" icon={ListChecks} value={t.total} onClick={() => go("")} />
        <StatCard label="Individual" icon={User} tone="info" value={t.individual} onClick={() => go("category=individual")} />
        <StatCard label="Organization" icon={Building2} tone="neutral" value={t.organization} onClick={() => go("category=organization")} />
        <StatCard label="Selected" icon={CheckCircle2} tone="success" value={t.selected} onClick={() => go("status=selected")} />
        <StatCard label="Not selected" icon={XCircle} tone="danger" value={t.not_selected} onClick={() => go("status=not_selected")} />
      </section>

      <div className="dash-grid">
        <section className="panel panel--span2 panel--chart">
          <header className="panel__head"><h2>Nominations per day</h2><Link to={`${AWARD_BASE}/nominations`}>All nominations →</Link></header>
          {s?.daily?.length ? <BarChart data={dailySeries(s.daily, s.window)} label="Nominations per day" /> : <p className="muted">{loading ? "Loading…" : "No nominations yet"}</p>}
        </section>
        <section className="panel">
          <header className="panel__head"><h2>Top districts</h2></header>
          {s?.by_district?.length ? <div className="mr"><HBarList items={s.by_district} /></div> : <p className="muted">No data yet</p>}
        </section>
        <section className="panel">
          <header className="panel__head"><h2>Work categories</h2></header>
          {s?.by_work?.length
            ? <div className="mr"><HBarList limit={12} items={s.by_work.map((w) => ({
                name: `${optionLabel(w.category === "organization" ? options?.organization_work : options?.individual_work, w.key)} (${w.category === "organization" ? "संस्था" : "व्यक्ती"})`,
                count: w.count,
              }))} /></div>
            : <p className="muted">No data yet</p>}
        </section>
      </div>
    </>
  );
}
