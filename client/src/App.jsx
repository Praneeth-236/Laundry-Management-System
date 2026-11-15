import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ClosetPage } from "./pages/ClosetPage.jsx";
import { LaundryPage } from "./pages/LaundryPage.jsx";
import { MissingPage } from "./pages/MissingPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { LoginPage, SignupPage } from "./pages/AuthPages.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";

function NotFoundPage() {
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">404</p><h1>That page is missing</h1><a className="button button-primary" href="/">Go home</a></section></main>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/closet" element={<ClosetPage />} />
          <Route path="/laundry" element={<LaundryPage />} />
          <Route path="/missing" element={<MissingPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="/app" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
