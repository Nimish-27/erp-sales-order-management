import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const emptyForm = { companyName: '', contactPerson: '', mobile: '', email: '', city: '' };

export const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    try {
      const { data } = await api.listCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const startCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const startEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      companyName: customer.companyName || '',
      contactPerson: customer.contactPerson || '',
      mobile: customer.mobile || '',
      email: customer.email || '',
      city: customer.city || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setSuccess('');
    try {
      if (editingId) await api.updateCustomer(editingId, form);
      else await api.createCustomer(form);
      setShowForm(false);
      setForm(emptyForm);
      setSuccess(editingId ? 'Customer updated' : 'Customer created');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deactivate = async (id) => {
    setError(''); setSuccess('');
    try {
      await api.deactivateCustomer(id);
      setSuccess('Customer deactivated');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Customers</h1>
        <div className="flex">
          <button className="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</button>
          <button onClick={startCreate}>+ New Customer</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {showForm && (
        <div className="card">
          <h3>{editingId ? 'Edit Customer' : 'New Customer'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row"><label>Company Name</label><input value={form.companyName} onChange={(e) => updateField('companyName', e.target.value)} required /></div>
            <div className="form-row"><label>Contact Person</label><input value={form.contactPerson} onChange={(e) => updateField('contactPerson', e.target.value)} /></div>
            <div className="form-row"><label>Mobile</label><input value={form.mobile} onChange={(e) => updateField('mobile', e.target.value)} /></div>
            <div className="form-row"><label>Email</label><input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} /></div>
            <div className="form-row"><label>City</label><input value={form.city} onChange={(e) => updateField('city', e.target.value)} /></div>
            <button type="submit">{editingId ? 'Save Changes' : 'Create Customer'}</button>
            <button type="button" className="secondary" style={{ marginLeft: 8 }} onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Company</th><th>Contact Person</th><th>Mobile</th><th>Email</th><th>City</th><th>Actions</th></tr></thead>
          <tbody>
            {customers.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>No active customers</td></tr>}
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.companyName}</td>
                <td>{customer.contactPerson || '—'}</td>
                <td>{customer.mobile || '—'}</td>
                <td>{customer.email || '—'}</td>
                <td>{customer.city || '—'}</td>
                <td><button onClick={() => startEdit(customer)}>Edit</button><button className="danger" style={{ marginLeft: 8 }} onClick={() => deactivate(customer.id)}>Deactivate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
