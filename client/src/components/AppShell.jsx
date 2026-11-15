import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const links = [
  ["/dashboard", "Overview", "⌂"],
  ["/closet", "My closet", "▤"],
  ["/laundry", "Laundry", "◌"],
  ["/missing", "Missing items", "⌕"],
  ["/profile", "Preferences", "⚙"],
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  async function logout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <NavLink className="brand" to="/dashboard"><span className="brand-mark">w</span><span>Washday</span></NavLink>
        <div className="sidebar-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <span className="nav-icon" aria-hidden="true">{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip"><span className="avatar">{user?.username?.[0]?.toUpperCase()}</span><span><strong>{user?.username}</strong><small>Personal space</small></span></div>
          <button className="text-button" onClick={logout}>Sign out <span aria-hidden="true">↗</span></button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="mobile-header"><NavLink className="brand" to="/dashboard"><span className="brand-mark">w</span><span>Washday</span></NavLink><span className="mobile-greeting">Hi, {user?.username}</span></header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {links.map(([to, label, icon]) => <NavLink key={to} to={to} aria-label={label} title={label} className={({ isActive }) => `mobile-nav-link${isActive ? " active" : ""}`}>{icon}</NavLink>)}
        </nav>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}
