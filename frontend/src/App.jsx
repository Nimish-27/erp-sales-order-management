import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login.jsx';
import { Enquiries } from './pages/Enquiries.jsx';
import { Quotations } from './pages/Quotations.jsx';
import { Orders } from './pages/Orders.jsx';
import { Dispatches } from './pages/Dispatches.jsx';
import { Products } from './pages/Products.jsx';
import { Customers } from './pages/Customers.jsx';
import { Layout } from './components/Layout.jsx';
import { RequireAuth } from './auth/RequireAuth.jsx';

const App = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<RequireAuth><Layout /></RequireAuth>}>
      <Route path="/enquiries" element={<Enquiries />} />
      <Route path="/quotations" element={<Quotations />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/dispatches" element={<Dispatches />} />
      <Route path="/products" element={<Products />} />
      <Route path="/customers" element={<Customers />} />
    </Route>
    <Route path="*" element={<Navigate to="/enquiries" replace />} />
  </Routes>
);

export default App;
