import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const initialsFor = (email = '') => email.split('@')[0].split(/[._-]/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';

export const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    ...(user?.role !== 'WAREHOUSE' ? [
      { to: '/enquiries', label: 'Enquiries', icon: '⌕' },
      { to: '/quotations', label: 'Quotations', icon: '▤' },
    ] : []),
    { to: '/orders', label: 'Sales orders', icon: '↗' },
    ...(user?.role === 'ADMIN' ? [{ to: '/dispatches', label: 'Dispatches', icon: '⇄' }] : []),
    ...(user?.role === 'ADMIN' ? [{ to: '/products', label: 'Products', icon: '◇' }] : []),
    ...(['ADMIN', 'SALES'].includes(user?.role) ? [{ to: '/customers', label: 'Customers', icon: '◎' }] : []),
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/orders" className="brand-lockup" aria-label="Fundsroom Inventory home">
          <span className="brand-mark">F</span>
          <span className="brand-copy"><strong>Fundsroom</strong><small>INVENTORY ERP</small></span>
        </NavLink>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `side-nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
              {to === '/orders' && <span className="nav-link-arrow" aria-hidden="true">›</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="workspace-status"><span className="status-indicator" />Workspace ready</div>
          <div className="profile-card">
            <div className="avatar">{initialsFor(user?.email)}</div>
            <div className="profile-copy"><strong>{user?.email?.split('@')[0] || 'User'}</strong><span>{user?.role || 'Team member'}</span></div>
            <button className="logout-button" onClick={handleLogout} aria-label="Log out" title="Log out">↗</button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div><span className="topbar-kicker">OPERATIONS</span><strong>Business workspace</strong></div>
          <div className="topbar-meta"><span className="topbar-dot" /> Inventory management</div>
        </header>
        <main className="container"><Outlet /></main>
        <footer className="workspace-footer"><span>Fundsroom Inventory</span><span>Sales · Stock · Fulfillment</span></footer>
      </div>
    </div>
  );
};
