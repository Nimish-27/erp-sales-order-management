import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

export const Quotations = () => {
  const { user } = useAuth();
  const canWrite = ['ADMIN', 'SALES'].includes(user?.role);
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [enquiryId, setEnquiryId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: '', discountPct: 0, gstPct: 18 }]);

  const load = async () => {
    try {
      const [{ data: qData }, { data: eData }, { data: pData }] = await Promise.all([
        api.listQuotations(),
        api.listEnquiries(),
        api.listProducts().catch(() => ({ data: [] })),
      ]);
      setQuotations(qData);
      setEnquiries(eData.filter((e) => ['OPEN', 'QUOTED'].includes(e.status)));
      setProducts(pData);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.createQuotation({
        enquiryId,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        notes: notes || undefined,
        items: items
          .filter((i) => i.productId && i.quantity > 0)
          .map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            unitPrice: i.unitPrice ? Number(i.unitPrice) : undefined,
            discountPct: Number(i.discountPct) || 0,
            gstPct: Number(i.gstPct) || 18,
          })),
      });
      setSuccess('Quotation created');
      setShowForm(false);
      setEnquiryId(''); setValidUntil(''); setNotes('');
      setItems([{ productId: '', quantity: 1, unitPrice: '', discountPct: 0, gstPct: 18 }]);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStatus = async (id, status) => {
    setError(''); setSuccess('');
    try {
      await api.updateQuotationStatus(id, status);
      setSuccess(`Quotation ${status.toLowerCase()}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const convertToOrder = async (id) => {
    setError(''); setSuccess('');
    try {
      await api.convertQuotationToOrder(id);
      setSuccess('Sales order created');
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

  return (
    <>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Quotations</h1>
        <div className="flex">
          <button className="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</button>
          {canWrite && <button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Quotation'}
          </button>}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>New Quotation</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label>From Enquiry</label>
              <select value={enquiryId} onChange={(e) => setEnquiryId(e.target.value)} required>
                <option value="">-- Select --</option>
                {enquiries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.enquiryNumber} — {e.customer?.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <h4 style={{ marginBottom: 8 }}>Items (leave blank to auto-derive from enquiry)</h4>
            {items.map((item, idx) => (
              <div key={idx} className="flex" style={{ marginBottom: 8 }}>
                <select
                  value={item.productId}
                  onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                  style={{ flex: 2 }}
                >
                  <option value="">-- Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.productCode} — {p.name}</option>
                  ))}
                </select>
                <input
                  type="number" min="1" value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  placeholder="Qty" style={{ flex: 1 }}
                />
                <input
                  type="number" step="0.01" value={item.unitPrice}
                  onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                  placeholder="Price" style={{ flex: 1 }}
                />
                <input
                  type="number" step="0.01" min="0" max="100" value={item.discountPct}
                  onChange={(e) => updateItem(idx, 'discountPct', e.target.value)}
                  placeholder="Disc %" style={{ flex: 1 }}
                />
                <input
                  type="number" step="0.01" min="0" max="100" value={item.gstPct}
                  onChange={(e) => updateItem(idx, 'gstPct', e.target.value)}
                  placeholder="GST %" style={{ flex: 1 }}
                />
              </div>
            ))}

            <div style={{ marginTop: 16 }}>
              <button type="submit">Create Quotation</button>
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
              <th>From Enquiry</th>
              <th>Grand Total</th>
              <th>Valid Until</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>No quotations yet</td></tr>
            )}
            {quotations.map((q) => (
              <tr key={q.id}>
                <td>{q.quotationNumber}</td>
                <td>{q.customer?.companyName || '—'}</td>
                <td>{q.enquiry?.enquiryNumber || '—'}</td>
                <td>₹ {parseFloat(q.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</td>
                <td><span className={`badge ${q.status}`}>{q.status}</span></td>
                <td>
                  <div className="flex">
                    {canWrite && q.status === 'DRAFT' && (
                      <button onClick={() => updateStatus(q.id, 'SENT')}>Send</button>
                    )}
                    {canWrite && q.status === 'SENT' && (
                      <>
                        <button onClick={() => updateStatus(q.id, 'ACCEPTED')}>Accept</button>
                        <button className="danger" onClick={() => updateStatus(q.id, 'REJECTED')}>Reject</button>
                      </>
                    )}
                    {canWrite && q.status === 'ACCEPTED' && !q.order && (
                      <button onClick={() => convertToOrder(q.id)}>Create Order</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};