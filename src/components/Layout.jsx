import {
  Award, BarChart3, ExternalLink, FileText, Globe, HelpCircle, Images,
  Headphones, Inbox, KeyRound, LayoutDashboard, LogOut, Map, Menu, MessageSquareQuote,
  ScrollText, Settings, ShieldCheck, Users, UserCog, X, ShieldOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SITE_URL } from "../lib/api.js";
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
    perm: ["forts"],   // if admin can see forts, show the whole Content group
    items: [
      { to: "/content/forts",          label: "Forts",            icon: Map              },
      { to: "/content/testimonials",   label: "Testimonials",     icon: MessageSquareQuote },
      { to: "/content/podcasts",       label: "Podcasts",         icon: Headphones       },
      { to: "/content/faqs",           label: "FAQs",             icon: HelpCircle       },
      { to: "/content/pages",          label: "Pages",            icon: FileText         },
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
    <div className={`shell ${open ? "is-nav-open" : ""}`}>
      <a href="#content" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar__brand">
          <img src="/logo.webp" alt="" width="40" height="40" />
          <div>
            <strong>Durgotsav 2026</strong>
            <span>Admin console</span>
          </div>
          <button type="button" className="icon-btn sidebar__close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
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
          <button type="button" className="icon-btn topbar__menu" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
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
          <Outlet />
        </main>
        <footer className="main__foot">
          <Images size={13} aria-hidden="true" /> Amrut Durgotsav 2026 · AMRUT, Pune
        </footer>
      </div>
    </div>
  );
}
