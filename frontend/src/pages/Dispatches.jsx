import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

export const Dispatches = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const selectedOrderId = searchParams.get('orderId') || '';
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const canDispatch = user?.role === 'ADMIN';

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.listOrders();
        if (active) setOrders(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const readyOrders = useMemo(() => orders.filter((order) => order.status === 'CONFIRMED'), [orders]);
  const dispatchHistory = useMemo(
    () => orders.filter((order) => ['DISPATCHED', 'DELIVERED'].includes(order.status)),
    [orders],
  );

  const startDispatch = (orderId) => {
    setError('');
    setSuccess('');
    setSearchParams(orderId ? { orderId } : {});
  };

  const handleDispatch = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.dispatchOrder(selectedOrderId, { vehicleNumber, driverName });
      setSuccess('Dispatch created and stock updated');
      setVehicleNumber('');
      setDriverName('');
      setSearchParams({});
      setRefreshKey((key) => key + 1);
    } catch (err) {
      if (err.details?.failures) {
        const failures = err.details.failures
          .map((failure) => `${failure.productCode}: requested ${failure.requested}, reserved ${failure.reserved}`)
          .join('; ');
        setError(`Dispatch error: ${failures}`);
      } else {
        setError(err.message);
      }
    }
  };

  if (!canDispatch) {
    return <div className="card access-card"><span className="access-icon">↗</span><h1>Dispatches</h1><p>Dispatch management is available to administrators.</p></div>;
  }

  return (
    <>
      <div className="page-heading">
        <div><span className="page-eyebrow">FULFILLMENT</span><h1>Dispatches</h1><p>Create shipments for confirmed orders and review dispatch activity.</p></div>
        <button className="secondary" onClick={() => setRefreshKey((key) => key + 1)}>↻ <span>Refresh</span></button>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {selectedOrderId && (
        <section className="card dispatch-form-card">
          <div className="section-heading"><div><span className="section-eyebrow">NEW SHIPMENT</span><h2>Create dispatch</h2><p>Assign a vehicle and driver to a confirmed sales order.</p></div><button type="button" className="secondary" onClick={() => startDispatch('')}>Close</button></div>
          <form onSubmit={handleDispatch}>
            <div className="dispatch-form-grid">
              <div className="form-row"><label htmlFor="dispatch-order">Confirmed order</label><select id="dispatch-order" value={selectedOrderId} onChange={(event) => startDispatch(event.target.value)} required>
                <option value="">Select an order</option>
                {readyOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customer?.companyName || 'Customer'}</option>)}
              </select></div>
              <div className="form-row"><label htmlFor="dispatch-vehicle">Vehicle number</label><input id="dispatch-vehicle" value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} placeholder="e.g. MH-12-AB-1234" minLength={3} maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9 .-]*" title="Use letters, numbers, spaces, dots, or hyphens" autoComplete="off" required /></div>
              <div className="form-row"><label htmlFor="dispatch-driver">Driver name</label><input id="dispatch-driver" value={driverName} onChange={(event) => setDriverName(event.target.value)} placeholder="Full name" minLength={2} maxLength={100} autoComplete="name" required /></div>
            </div>
            <div className="form-actions"><button type="submit">Create dispatch</button><span>Stock will be deducted when dispatch is created.</span></div>
          </form>
        </section>
      )}

      <section className="card dispatch-section">
        <div className="section-heading"><div><span className="section-eyebrow">READY TO SHIP</span><h2>Confirmed orders</h2><p>These orders have reserved stock and are ready for fulfillment.</p></div><span className="count-chip">{readyOrders.length} ready</span></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Sales order</th><th>Customer</th><th>Order date</th><th>Items</th><th>Order total</th><th>Action</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="empty-state">Loading confirmed orders…</td></tr>}
            {!loading && readyOrders.length === 0 && <tr><td colSpan="6" className="empty-state">No confirmed orders are waiting for dispatch.</td></tr>}
            {!loading && readyOrders.map((order) => (
              <tr key={order.id}>
                <td><strong className="table-primary">{order.orderNumber}</strong></td>
                <td>{order.customer?.companyName || '—'}</td>
                <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                <td><span className="count-chip subtle">{order.items?.length || 0} line items</span></td>
                <td>₹ {parseFloat(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td><button onClick={() => startDispatch(order.id)}>Create dispatch</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      <section className="card dispatch-section">
        <div className="section-heading"><div><span className="section-eyebrow">RECENT ACTIVITY</span><h2>Dispatch history</h2><p>Previously dispatched and delivered orders.</p></div><span className="count-chip subtle">{dispatchHistory.length} records</span></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Sales order</th><th>Dispatch number</th><th>Customer</th><th>Status</th><th>Order date</th></tr></thead>
          <tbody>
            {dispatchHistory.length === 0 && <tr><td colSpan="5" className="empty-state">No dispatches yet. Created shipments will appear here.</td></tr>}
            {dispatchHistory.map((order) => (
              <tr key={order.id}>
                <td><strong className="table-primary">{order.orderNumber}</strong></td>
                <td>{order.dispatch?.dispatchNumber || '—'}</td>
                <td>{order.customer?.companyName || '—'}</td>
                <td><span className={`badge ${order.dispatch?.status || order.status}`}>{order.dispatch?.status || order.status}</span></td>
                <td>{new Date(order.orderDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </>
  );
};
