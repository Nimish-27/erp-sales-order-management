import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const emptyForm = {
  productCode: '',
  name: '',
  category: '',
  unit: 'pcs',
  basePrice: '',
  gstPercent: 18,
  physicalQty: 0,
  reorderLevel: 0,
};

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const { data } = await api.listProducts();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.createProduct({
        ...form,
        basePrice: Number(form.basePrice),
        gstPercent: Number(form.gstPercent),
        physicalQty: Number(form.physicalQty),
        reorderLevel: Number(form.reorderLevel),
      });
      setForm(emptyForm);
      setShowForm(false);
      setSuccess('Product created');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deactivate = async (id) => {
    setError('');
    setSuccess('');
    try {
      await api.deleteProduct(id);
      setSuccess('Product deactivated');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Products</h1>
        <div className="flex">
          <button className="secondary" onClick={load}>Refresh</button>
          <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Product'}</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>New Product</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row"><label>Product Code</label><input value={form.productCode} onChange={(e) => updateField('productCode', e.target.value)} required /></div>
            <div className="form-row"><label>Name</label><input value={form.name} onChange={(e) => updateField('name', e.target.value)} required /></div>
            <div className="form-row"><label>Category</label><input value={form.category} onChange={(e) => updateField('category', e.target.value)} required /></div>
            <div className="form-row"><label>Unit</label><input value={form.unit} onChange={(e) => updateField('unit', e.target.value)} required /></div>
            <div className="form-row"><label>Base Price</label><input type="number" min="0" step="0.01" value={form.basePrice} onChange={(e) => updateField('basePrice', e.target.value)} required /></div>
            <div className="form-row"><label>GST %</label><input type="number" min="0" max="100" step="0.01" value={form.gstPercent} onChange={(e) => updateField('gstPercent', e.target.value)} required /></div>
            <div className="form-row"><label>Physical Quantity</label><input type="number" min="0" step="1" value={form.physicalQty} onChange={(e) => updateField('physicalQty', e.target.value)} required /></div>
            <div className="form-row"><label>Reorder Level</label><input type="number" min="0" step="1" value={form.reorderLevel} onChange={(e) => updateField('reorderLevel', e.target.value)} required /></div>
            <button type="submit">Create Product</button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>Price</th><th>GST</th><th>Actions</th></tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>No products yet</td></tr>}
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.productCode}</td>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>{product.unit}</td>
                <td>₹ {Number(product.basePrice).toFixed(2)}</td>
                <td>{Number(product.gstPercent)}%</td>
                <td><button className="danger" onClick={() => deactivate(product.id)}>Deactivate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
