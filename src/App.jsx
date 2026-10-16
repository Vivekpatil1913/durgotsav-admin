import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { UiProvider } from "./context/UiContext.jsx";
import Login from "./pages/Login.jsx";

const Dashboard     = lazy(() => import("./pages/Dashboard.jsx"));
const Registrations = lazy(() => import("./pages/Registrations.jsx"));
const Moderation    = lazy(() => import("./pages/Moderation.jsx"));
const Certificates  = lazy(() => import("./pages/Certificates.jsx"));
const Districts     = lazy(() => import("./pages/Districts.jsx"));
const CityStats     = lazy(() => import("./pages/CityStats.jsx"));
const ResourcePage  = lazy(() => import("./pages/ResourcePage.jsx"));
const Settings      = lazy(() => import("./pages/Settings.jsx"));
const AuditLogs     = lazy(() => import("./pages/AuditLogs.jsx"));
const Profile       = lazy(() => import("./pages/Profile.jsx"));
const Roles         = lazy(() => import("./pages/Roles.jsx"));
const Users         = lazy(() => import("./pages/Users.jsx"));
const AwardDashboard = lazy(() => import("./pages/award/AwardDashboard.jsx"));
const AwardNominations = lazy(() => import("./pages/award/AwardNominations.jsx"));
const AwardNominationDetail = lazy(() => import("./pages/award/AwardNominationDetail.jsx"));
const AwardSettings = lazy(() => import("./pages/award/AwardSettings.jsx"));
const WebsiteGallery = lazy(() => import("./pages/WebsiteGallery.jsx"));

function Loading() {
  return <div className="page-loading"><Spinner size={22} /></div>;
}

// Generic auth guard. `perm` = [moduleKey, level?] check; `roles` = legacy role list.
function Protected({ children, perm, roles }) {
  const { admin, ready, can, hasPermission } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !can(...roles)) {
    return <div className="content"><div className="alert alert--error">You do not have access to this section.</div></div>;
  }
  if (perm && !hasPermission(perm[0], perm[1] ?? "read")) {
    return <div className="content"><div className="alert alert--error">You do not have access to this section.</div></div>;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UiProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Protected><Layout /></Protected>}>
                <Route index element={<Dashboard />} />
                <Route path="moderation"    element={<Moderation />} />
                <Route path="registrations" element={<Registrations />} />
                <Route path="certificates"  element={<Certificates />} />
                <Route path="districts"     element={<Districts />} />
                <Route path="city-stats"    element={<CityStats />} />
                <Route path="website-gallery" element={
                  <Protected perm={["website_gallery", "read"]}><WebsiteGallery /></Protected>
                } />
                <Route path="content/:resource" element={<ResourcePage />} />

                {/* शिवदुर्ग भूषण पुरस्कार २०२६ */}
                <Route path="shivdurg-award" element={<Protected perm={["shivdurg_award", "read"]}><AwardDashboard /></Protected>} />
                <Route path="shivdurg-award/nominations" element={<Protected perm={["shivdurg_award", "read"]}><AwardNominations /></Protected>} />
                <Route path="shivdurg-award/nominations/:id" element={<Protected perm={["shivdurg_award", "read"]}><AwardNominationDetail /></Protected>} />
                <Route path="shivdurg-award/settings" element={<Protected perm={["shivdurg_award_config", "read"]}><AwardSettings /></Protected>} />

                {/* RBAC management — requires roles/users permissions */}
                <Route path="roles" element={
                  <Protected perm={["roles", "read"]}><Roles /></Protected>
                } />
                <Route path="users" element={
                  <Protected perm={["users", "read"]}><Users /></Protected>
                } />

                <Route path="settings"   element={<Protected perm={["settings", "read"]}><Settings /></Protected>} />
                <Route path="audit-logs" element={<Protected perm={["audit_logs", "read"]}><AuditLogs /></Protected>} />
                <Route path="profile"    element={<Profile />} />
                <Route path="*"          element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </UiProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
