import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { UiProvider } from "./context/UiContext.jsx";
import Login from "./pages/Login.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Registrations = lazy(() => import("./pages/Registrations.jsx"));
const Moderation = lazy(() => import("./pages/Moderation.jsx"));
const Certificates = lazy(() => import("./pages/Certificates.jsx"));
const Districts = lazy(() => import("./pages/Districts.jsx"));
const ResourcePage = lazy(() => import("./pages/ResourcePage.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const AuditLogs = lazy(() => import("./pages/AuditLogs.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));

function Loading() {
  return <div className="page-loading"><Spinner size={22} /></div>;
}

function Protected({ children, roles }) {
  const { admin, ready, can } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !can(...roles)) return <div className="content"><div className="alert alert--error">You do not have access to this section.</div></div>;
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
                <Route path="moderation" element={<Moderation />} />
                <Route path="registrations" element={<Registrations />} />
                <Route path="certificates" element={<Certificates />} />
                <Route path="districts" element={<Districts />} />
                <Route path="content/:resource" element={<ResourcePage />} />
                <Route path="settings" element={<Protected roles={["admin"]}><Settings /></Protected>} />
                <Route path="audit-logs" element={<Protected roles={["admin"]}><AuditLogs /></Protected>} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </UiProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
