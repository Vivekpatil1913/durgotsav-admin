import {
  AlertTriangle, Award, BarChart3, ExternalLink, FileText, Globe, HelpCircle, Images,
  Headphones, Inbox, KeyRound, LayoutDashboard, LogOut, Map, Menu, MessageSquareQuote, PanelLeftClose, PanelLeftOpen,
  ScrollText, Settings, ShieldCheck, Users, UserCog, X, ShieldOff, Trophy, ListChecks, Landmark, SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { EDITION_YEAR } from "../config/edition.js";
import { useAuth } from "../context/AuthContext.jsx";
import { api, SITE_URL } from "../lib/api.js";
import { AWARD_SECTION } from "../lib/award.js";
import { ROLES } from "../lib/format.js";

// Navigation definition.
// `perm` = [moduleKey, level] checked via hasPermission()
// `roles` = legacy role list fallback (kept for CMS group which uses generic ResourcePage)
export const NAV = [
  {
    group: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, perm: ["dashboard"] }],
  },
  {
    group: "Participation",
    items: [
      { to: "/moderation",    label: "Photo review",   icon: ShieldCheck, perm: ["moderation"] },
      { to: "/registrations", label: "Registrations",  icon: Users,       perm: ["registrations"] },
      { to: "/certificates",  label: "Certificates",   icon: Award,       perm: ["certificates"] },
      { to: "/districts",     label: "District stats", icon: BarChart3,   perm: ["dashboard"] },
    ],
  },
  {
    group: AWARD_SECTION,
    items: [
      { to: "/shivdurg-award", label: "Award dashboard", icon: Trophy, end: true, perm: ["shivdurg_award"] },
      { to: "/shivdurg-award/nominations", label: "Nominations", icon: ListChecks, perm: ["shivdurg_award"] },
      { to: "/shivdurg-award/settings", label: "Award settings", icon: SlidersHorizontal, perm: ["shivdurg_award_config"] },
      // { to: "/content/award-committee", label: "Committee", icon: Landmark, perm: ["shivdurg_award_config"] },
      { to: "/content/award-winners", label: "Previous winners", icon: Award, perm: ["shivdurg_award_config"] },
    ],
  },
  {
    group: "Geography",
    perm: ["geography"],
    items: [
      { to: "/content/divisions", label: "Divisions", icon: Globe },
      { to: "/content/districts", label: "Districts", icon: Map  },
      { to: "/content/talukas",   label: "Talukas",   icon: Globe },
    ],
  },
  {
    group: "Content",
    items: [
      { to: "/website-gallery",        label: "Website Gallery",  icon: Images,             perm: ["website_gallery"] },
      { to: "/content/forts",          label: "Forts",            icon: Map,                perm: ["forts"]           },
      { to: "/content/testimonials",   label: "Testimonials",     icon: MessageSquareQuote, perm: ["content"]         },
      { to: "/content/podcasts",       label: "Podcasts",         icon: Headphones,         perm: ["content"]         },
      { to: "/content/faqs",           label: "FAQs",             icon: HelpCircle,         perm: ["content"]         },
      { to: "/content/pages",          label: "Pages",            icon: FileText,           perm: ["content"]         },
    ],
  },
  {
    group: "Inbox",
    items: [{ to: "/content/enquiries", label: "Contact enquiries", icon: Inbox }],
  },
  {
    group: "System",
    items: [
      { to: "/users",      label: "Admin users", icon: UserCog,    perm: ["users"]      },
      { to: "/roles",      label: "Roles",       icon: ShieldOff,  perm: ["roles"]      },
      { to: "/settings",   label: "Settings",    icon: Settings,   perm: ["settings"]   },
      { to: "/audit-logs", label: "Audit log",   icon: ScrollText, perm: ["audit_logs"] },
    ],
  },
];

export function Layout() {
  const { admin, logout, can, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  // The API reports the edition it runs; a different year means one of the three apps was not updated
  const [apiYear, setApiYear] = useState(null);
  useEffect(() => {
    api.get("/settings").then((r) => setApiYear(r.data.data?.edition_year ?? null)).catch(() => {});
  }, []);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1"); } catch { /* ignore */ }
    return !c;
  });

  const groups = NAV
    .filter((g) => {
      if (g.perm && !hasPermission(...g.perm)) return false;
      return true;
    })
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.perm || hasPermission(...i.perm)),
    }))
    .filter((g) => g.items.length);

  return (
    <div className={`shell ${open ? "is-nav-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
      <a href="#content" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar__brand">
          <img src="/logo.webp" alt="" width="40" height="40" />
          <div>
            <strong>Durgotsav {EDITION_YEAR}</strong>
            <span>Admin console</span>
          </div>
          <button type="button" className="icon-btn sidebar__close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar__nav">
          {groups.map((g) => (
            <div key={g.group} className="sidebar__group">
              <span className="sidebar__group-label" lang={/[ऀ-ॿ]/.test(g.group) ? "mr" : undefined}>{g.group}</span>
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className="sidebar__link" title={collapsed ? label : undefined}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <a className="sidebar__site" href={SITE_URL} target="_blank" rel="noopener noreferrer" title={collapsed ? "View public website" : undefined}>
          <ExternalLink size={15} aria-hidden="true" /> <span>View public website</span>
        </a>
      </aside>
      <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar__menu" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <button
            type="button"
            className="icon-btn topbar__collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <div className="topbar__spacer" />
          <details className="profile">
            <summary>
              <span className="avatar" aria-hidden="true">{admin.name.slice(0, 1).toUpperCase()}</span>
              <span className="profile__text">
                <strong>{admin.name}</strong>
                <small>{admin.role_name ?? ROLES[admin.role] ?? admin.role}</small>
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
          {apiYear && apiYear !== EDITION_YEAR && (
            <div className="alert alert--warning" role="alert">
              <AlertTriangle size={16} aria-hidden="true" /> This admin console is set to {EDITION_YEAR} but the API runs {apiYear}.
              Set the same EDITION_YEAR in src/config/edition.js of the admin console, API and website, then redeploy.
            </div>
          )}
          <Outlet />
        </main>
        <footer className="main__foot">
          <Images size={13} aria-hidden="true" /> Amrut Durgotsav {EDITION_YEAR} · AMRUT, Pune
        </footer>
      </div>
    </div>
  );
}
