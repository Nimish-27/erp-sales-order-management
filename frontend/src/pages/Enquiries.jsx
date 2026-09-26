import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

export const Enquiries = () => {
  const { user } = useAuth();
  const canWrite = ['ADMIN', 'SALES'].includes(user?.role);
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);

  const load = async () => {
    try {
      const [{ data: enqData }, { data: custData }, { data: prodData }] = await Promise.all([
        api.listEnquiries(),
        api.listCustomers().catch(() => ({ data: [] })),
        api.listProducts().catch(() => ({ data: [] })),
      ]);
      setEnquiries(enqData);
      setCustomers(custData);
      setProducts(prodData);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.createEnquiry({
        customerId,
        requiredDate: requiredDate
          ? new Date(`${requiredDate}T00:00:00.000Z`).toISOString()
          : undefined,
        notes: notes || undefined,
        items: items
          .filter((i) => i.productId && i.quantity > 0)
          .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
      });
      setSuccess('Enquiry created');
      setShowForm(false);
      setItems([{ productId: '', quantity: 1 }]);
      setNotes('');
      setRequiredDate('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateItem = (idx, field, value) => {
    const next = [...items];
    next[idx][field] = value;
    setItems(next);
  };

  const addItem = () => setItems([...items, { productId: '', quantity: 1 }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  return (
    <>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Enquiries</h1>
        {canWrite && <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Enquiry'}
        </button>}
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>New Enquiry</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label>Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">-- Select --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Required Date</label>
              <input
                type="date" value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <h4 style={{ marginBottom: 8 }}>Items</h4>
            {items.map((item, idx) => (
              <div key={idx} className="flex" style={{ marginBottom: 8 }}>
                <select
                  value={item.productId}
                  onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                  required style={{ flex: 2 }}
                >
                  <option value="">-- Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productCode} — {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number" min="1" value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  required style={{ flex: 1 }}
                />
                {items.length > 1 && (
                  <button type="button" className="danger" onClick={() => removeItem(idx)}>×</button>
                )}
              </div>
            ))}
            <button type="button" className="secondary" onClick={addItem}>+ Add Item</button>

            <div style={{ marginTop: 16 }}>
              <button type="submit">Create Enquiry</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Required</th>
              <th>Items</th>
              <th>Status</th>
              <th>Quotations</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>No enquiries yet</td></tr>
            )}
            {enquiries.map((e) => (
              <tr key={e.id}>
                <td>{e.enquiryNumber}</td>
                <td>{e.customer?.companyName || '—'}</td>
                <td>{new Date(e.enquiryDate).toLocaleDateString()}</td>
                <td>{e.requiredDate ? new Date(e.requiredDate).toLocaleDateString() : '—'}</td>
                <td>{e.items?.length || 0}</td>
                <td><span className={`badge ${e.status}`}>{e.status}</span></td>
                <td>
                  {e.quotations?.map((q) => (
                    <div key={q.id} style={{ fontSize: 12 }}>
                      {q.quotationNumber} <span className={`badge ${q.status}`}>{q.status}</span>
                    </div>
                  )) || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};