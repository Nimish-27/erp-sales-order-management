import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const emptyForm = { companyName: '', contactPerson: '', mobile: '', email: '', city: '' };
const countryCodes = [
  ['+91', 'India'], ['+1', 'United States / Canada'], ['+44', 'United Kingdom'],
  ['+61', 'Australia'], ['+64', 'New Zealand'], ['+971', 'United Arab Emirates'],
  ['+966', 'Saudi Arabia'], ['+65', 'Singapore'], ['+60', 'Malaysia'],
  ['+49', 'Germany'], ['+33', 'France'], ['+39', 'Italy'],
  ['+34', 'Spain'], ['+31', 'Netherlands'], ['+81', 'Japan'], ['+82', 'South Korea'],
  ['+86', 'China'], ['+880', 'Bangladesh'], ['+92', 'Pakistan'], ['+94', 'Sri Lanka'],
  ['+977', 'Nepal'], ['+63', 'Philippines'], ['+62', 'Indonesia'], ['+27', 'South Africa'],
  ['+234', 'Nigeria'], ['+254', 'Kenya'], ['+55', 'Brazil'], ['+52', 'Mexico'],
];

const getPhoneParts = (phone = '') => {
  const digits = phone.replace(/\D/g, '');
  const matches = [...countryCodes]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([code]) => digits.startsWith(code.slice(1)) && digits.length === code.length - 1 + 10);
  if (matches) return { countryCode: matches[0], number: digits.slice(matches[0].length - 1) };
  return { countryCode: '+91', number: digits.length === 10 ? digits : '' };
};

export const Customers = () => {
  const { user } = useAuth();
  const canCreate = ['ADMIN', 'SALES'].includes(user?.role);
  const canManage = user?.role === 'ADMIN';
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [countryCode, setCountryCode] = useState('+91');
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.listCustomers();
        setCustomers(data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [refreshKey]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const startCreate = () => { setEditingId(null); setForm(emptyForm); setCountryCode('+91'); setShowForm(true); };
  const startEdit = (customer) => {
    const phone = getPhoneParts(customer.mobile || '');
    setEditingId(customer.id);
    setCountryCode(phone.countryCode);
    setForm({
      companyName: customer.companyName || '',
      contactPerson: customer.contactPerson || '',
      mobile: phone.number,
      email: customer.email || '',
      city: customer.city || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setSuccess('');
    try {
      const customerData = { ...form, mobile: `${countryCode}${form.mobile}` };
      if (editingId) await api.updateCustomer(editingId, customerData);
      else await api.createCustomer(customerData);
      setShowForm(false);
      setForm(emptyForm);
      setSuccess(editingId ? 'Customer updated' : 'Customer created');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const deactivate = async (id) => {
    setError(''); setSuccess('');
    try {
      await api.deactivateCustomer(id);
      setSuccess('Customer deactivated');
      setRefreshKey((k) => k + 1);
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
          {canCreate && <button onClick={startCreate}>+ New Customer</button>}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {showForm && canCreate && (
        <div className="card">
          <h3>{editingId ? 'Edit Customer' : 'New Customer'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row"><label htmlFor="customer-company">Company</label><input id="customer-company" value={form.companyName} onChange={(e) => updateField('companyName', e.target.value)} minLength={2} maxLength={200} autoComplete="organization" required /></div>
            <div className="form-row"><label htmlFor="customer-contact">Contact Person</label><input id="customer-contact" value={form.contactPerson} onChange={(e) => updateField('contactPerson', e.target.value)} minLength={2} maxLength={100} autoComplete="name" required /></div>
            <div className="form-row"><label htmlFor="customer-mobile">Mobile</label><div className="flex">
              <select aria-label="Country calling code" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} required style={{ maxWidth: 240 }}>
                {countryCodes.map(([code, country], index) => <option key={`${code}-${country}-${index}`} value={code}>{country} ({code})</option>)}
              </select>
              <input id="customer-mobile" type="tel" inputMode="numeric" value={form.mobile} onChange={(e) => updateField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} minLength={10} maxLength={10} pattern="[0-9]{10}" title="Enter exactly 10 digits; select the country code separately" autoComplete="tel-national" placeholder="10 digit number" required />
            </div></div>
            <div className="form-row"><label htmlFor="customer-email">Email</label><input id="customer-email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} maxLength={254} autoComplete="email" required /></div>
            <div className="form-row"><label htmlFor="customer-city">City</label><input id="customer-city" value={form.city} onChange={(e) => updateField('city', e.target.value)} minLength={2} maxLength={100} autoComplete="address-level2" required /></div>
            <button type="submit">{editingId ? 'Save Changes' : 'Create Customer'}</button>
            <button type="button" className="secondary" style={{ marginLeft: 8 }} onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Company</th><th>Contact Person</th><th>Mobile</th><th>Email</th><th>City</th>{canManage && <th>Actions</th>}</tr></thead>
          <tbody>
            {customers.length === 0 && <tr><td colSpan={canManage ? 6 : 5} style={{ textAlign: 'center', padding: 20 }}>No active customers</td></tr>}
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.companyName}</td>
                <td>{customer.contactPerson || '—'}</td>
                <td>{customer.mobile || '—'}</td>
                <td>{customer.email || '—'}</td>
                <td>{customer.city || '—'}</td>
                {canManage && <td><button onClick={() => startEdit(customer)}>Edit</button><button className="danger" style={{ marginLeft: 8 }} onClick={() => deactivate(customer.id)}>Deactivate</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
