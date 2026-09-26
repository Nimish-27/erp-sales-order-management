import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <header>
        <nav>
          {user?.role !== 'WAREHOUSE' && (
            <>
              <NavLink to="/enquiries" className={({ isActive }) => isActive ? 'active' : ''}>Enquiries</NavLink>
              <NavLink to="/quotations" className={({ isActive }) => isActive ? 'active' : ''}>Quotations</NavLink>
            </>
          )}
          <NavLink to="/orders" className={({ isActive }) => isActive ? 'active' : ''}>Orders</NavLink>
          {user?.role === 'ADMIN' && (
            <>
              <NavLink to="/products" className={({ isActive }) => isActive ? 'active' : ''}>Products</NavLink>
              <NavLink to="/customers" className={({ isActive }) => isActive ? 'active' : ''}>Customers</NavLink>
            </>
          )}
        </nav>
        <div className="flex">
          <span className="user">{user?.email} ({user?.role})</span>
          <button className="secondary" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <div className="container">
        <Outlet />
      </div>
    </div>
  );
};