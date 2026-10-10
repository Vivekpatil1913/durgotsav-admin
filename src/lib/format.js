const dt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const d = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const n = new Intl.NumberFormat("en-IN");

export const fmtDateTime = (v) => (v ? dt.format(new Date(v)) : "—");
export const fmtDate = (v) => (v ? d.format(new Date(v.length === 10 ? `${v}T00:00:00+05:30` : v)) : "—");
export const fmtNumber = (v) => n.format(Number(v) || 0);

export function timeAgo(v) {
  if (!v) return "";
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(v);
}

export const STATUS = {
  pending: { label: "Pending", tone: "warning" },
  info_requested: { label: "Info requested", tone: "info" },
  verified: { label: "Verified", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const PARTICIPANT_TYPES = {
  individual: "Individual",
  family: "Family",
  housing_society: "Housing society",
  organization: "Organisation",
  group: "Group",
  school: "School",
  college: "College",
};

export const ROLES = { super_admin: "Super admin", admin: "Admin", moderator: "Moderator" };
