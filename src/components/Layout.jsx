import {
  Award, BarChart3, CalendarDays, ExternalLink, FileText, HelpCircle, Images, Inbox, KeyRound, LayoutDashboard,
  LogOut, Map, Megaphone, Menu, MessageSquareQuote, ScrollText, Settings, ShieldCheck, Users, UserCog, Video, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SITE_URL } from "../lib/api.js";
import { ROLES } from "../lib/format.js";

// roles: who sees the item (super_admin sees everything)
export const NAV = [
  { group: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    group: "Participation",
    items: [
      { to: "/moderation", label: "Photo review", icon: ShieldCheck },
      { to: "/registrations", label: "Registrations", icon: Users },
      { to: "/certificates", label: "Certificates", icon: Award },
      { to: "/districts", label: "District stats", icon: BarChart3 },
    ],
  },
  {
    group: "Content",
    roles: ["admin"],
    items: [
      { to: "/content/forts", label: "Forts", icon: Map },
      { to: "/content/events", label: "Timeline / events", icon: CalendarDays },
      { to: "/content/announcements", label: "Announcements", icon: Megaphone },
      { to: "/content/videos", label: "Videos", icon: Video },
      { to: "/content/testimonials", label: "Testimonials", icon: MessageSquareQuote },
      { to: "/content/faqs", label: "FAQs", icon: HelpCircle },
      { to: "/content/pages", label: "Pages", icon: FileText },
    ],
  },
  { group: "Inbox", items: [{ to: "/content/enquiries", label: "Contact enquiries", icon: Inbox }] },
  {
    group: "System",
    roles: ["admin"],
    items: [
      { to: "/content/admins", label: "Admin users", icon: UserCog, roles: ["super_admin"] },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/audit-logs", label: "Audit log", icon: ScrollText },
    ],
  },
];

export function Layout() {
  const { admin, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const groups = NAV.filter((g) => !g.roles || can(...g.roles))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || can(...i.roles)) }))
    .filter((g) => g.items.length);

  return (
    <div className={`shell ${open ? "is-nav-open" : ""}`}>
      <a href="#content" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar__brand">
          <img src="/logo.webp" alt="" width="40" height="40" />
          <div>
            <strong>Durgotsav 2026</strong>
            <span>Admin console</span>
          </div>
          <button type="button" className="icon-btn sidebar__close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="sidebar__nav">
          {groups.map((g) => (
            <div key={g.group} className="sidebar__group">
              <span className="sidebar__group-label">{g.group}</span>
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className="sidebar__link">
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <a className="sidebar__site" href={SITE_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} aria-hidden="true" /> View public website
        </a>
      </aside>
      <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar__menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="topbar__spacer" />
          <details className="profile">
            <summary>
              <span className="avatar" aria-hidden="true">{admin.name.slice(0, 1).toUpperCase()}</span>
              <span className="profile__text">
                <strong>{admin.name}</strong>
                <small>{ROLES[admin.role]}</small>
              </span>
            </summary>
            <div className="profile__menu">
              <span className="profile__email">{admin.email}</span>
              <NavLink to="/profile"><KeyRound size={15} /> Change password</NavLink>
              <button type="button" onClick={logout}><LogOut size={15} /> Sign out</button>
            </div>
          </details>
        </header>
        <main id="content" className="content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="main__foot"><Images size={13} aria-hidden="true" /> Amrut Durgotsav 2026 · AMRUT, Pune</footer>
      </div>
    </div>
  );
}
