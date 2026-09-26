import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

export const Orders = () => {
  const { user } = useAuth();
  const canConfirm = user?.role === 'ADMIN';
  const canDispatch = user?.role === 'ADMIN';
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Dispatch form state
  const [dispatchOrderId, setDispatchOrderId] = useState(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');

  const load = async () => {
    try {
      const [{ data: oData }, { data: iData }] = await Promise.all([
        api.listOrders(),
        api.listInventory(),
      ]);
      setOrders(oData);
      setInventory(iData);
      const inventoryMap = new Map(iData.map((i) => [i.productId, i]));
      window.__inventoryMap = inventoryMap;
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const inventoryMap = new Map(inventory.map((i) => [i.productId, i]));

  const handleConfirm = async (id) => {
    setError(''); setSuccess('');
    try {
      await api.confirmOrder(id);
      setSuccess('Order confirmed — stock reserved');
      load();
    } catch (err) {
      if (err.details?.failures) {
        const failList = err.details.failures
          .map((f) => `${f.productCode}: need ${f.requested}, available ${f.available}`)
          .join('; ');
        setError(`Insufficient stock: ${failList}`);
      } else {
        setError(err.message);
      }
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.dispatchOrder(dispatchOrderId, {
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
      });
      setSuccess('Order dispatched — stock decremented');
      setDispatchOrderId(null);
      setVehicleNumber(''); setDriverName('');
      load();
    } catch (err) {
      if (err.details?.failures) {
        const failList = err.details.failures
          .map((f) => `${f.productCode}: requested ${f.requested}, reserved ${f.reserved}`)
          .join('; ');
        setError(`Dispatch error: ${failList}`);
      } else {
        setError(err.message);
      }
    }
  };

  const totalAvailable = (productIds) =>
    productIds.reduce((min, pid) => {
      const inv = inventoryMap.get(pid);
      const avail = inv ? inv.availableQty : 0;
      return Math.min(min, avail);
    }, Infinity);

  return (
    <>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Sales Orders</h1>
        <button className="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</button>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {dispatchOrderId && canDispatch && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Dispatch Order</h3>
          <form onSubmit={handleDispatch}>
            <div className="form-row">
              <label>Vehicle Number</label>
              <input
                value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="MH-12-AB-1234"
              />
            </div>
            <div className="form-row">
              <label>Driver Name</label>
              <input
                value={driverName} onChange={(e) => setDriverName(e.target.value)}
              />
            </div>
            <div className="flex">
              <button type="submit">Confirm Dispatch</button>
              <button type="button" className="secondary" onClick={() => setDispatchOrderId(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Items</th>
              <th>Min Available</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: 20 }}>No orders yet</td></tr>
            )}
            {orders.map((o) => {
              const productIds = o.items?.map((i) => i.productId) || [];
              const minAvail = totalAvailable(productIds);
              const hasStockIssue = o.status === 'CREATED' && (minAvail === 0 || minAvail === Infinity);

              return (
                <tr key={o.id}>
                  <td>{o.orderNumber}</td>
                  <td>{o.customer?.companyName || '—'}</td>
                  <td>{new Date(o.orderDate).toLocaleDateString()}</td>
                  <td>
                    {o.items?.map((i, idx) => {
                      const inv = inventoryMap.get(i.productId);
                      const avail = inv?.availableQty ?? 0;
                      const color = avail < i.quantity ? '#dc2626' : '#065f46';
                      return (
                        <div key={idx} style={{ fontSize: 12, marginBottom: 2 }}>
                          {i.product?.productCode}: {i.quantity}
                          {inv && (
                            <span style={{ color, marginLeft: 6 }}>
                              (avail: {avail})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </td>
                  <td>
                    {minAvail === Infinity ? '—' : (
                      <span style={{
                        color: minAvail === 0 ? '#dc2626' : '#065f46',
                        fontWeight: 600,
                      }}>
                        {minAvail}
                      </span>
                    )}
                  </td>
                  <td>₹ {parseFloat(o.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td><span className={`badge ${o.status}`}>{o.status}</span></td>
                  <td>
                    <div className="flex">
                      {o.status === 'CREATED' && canConfirm && (
                        <button onClick={() => handleConfirm(o.id)} disabled={hasStockIssue}>
                          {hasStockIssue ? 'No Stock' : 'Confirm'}
                        </button>
                      )}
                      {o.status === 'CREATED' && !canConfirm && (
                        <span style={{ fontSize: 12, color: '#64748b' }}>Awaiting admin confirmation</span>
                      )}
                      {o.status === 'CONFIRMED' && canDispatch && (
                        <button onClick={() => setDispatchOrderId(o.id)}>Dispatch</button>
                      )}
                      {o.status === 'DISPATCHED' && o.dispatches?.[0] && (
                        <span style={{ fontSize: 12 }}>
                          {o.dispatches[0].dispatchNumber}
                          <br />
                          <span className={`badge ${o.dispatches[0].status}`}>
                            {o.dispatches[0].status}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Inventory Snapshot</h3>
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Physical</th>
                <th>Reserved</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((i) => (
                <tr key={i.productId}>
                  <td>{i.productCode}</td>
                  <td>{i.productName}</td>
                  <td>{i.physicalQty}</td>
                  <td>{i.reservedQty}</td>
                  <td style={{ color: i.availableQty === 0 ? '#dc2626' : '#065f46', fontWeight: 600 }}>
                    {i.availableQty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};