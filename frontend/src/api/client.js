const BASE = '/api';

export const getToken = () => localStorage.getItem('token');

export const setToken = (token) => localStorage.setItem('token', token);
export const clearToken = () => localStorage.removeItem('token');

const request = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    err.details = data.details;
    throw err;
  }

  return data;
};

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (email, password, role) =>
    request('/auth/register', { method: 'POST', body: { email, password, role } }),
  me:    () => request('/auth/me'),

  // Enquiries
  listEnquiries:   () => request('/enquiries'),
  getEnquiry:      (id) => request(`/enquiries/${id}`),
  createEnquiry:   (data) => request('/enquiries', { method: 'POST', body: data }),
  updateEnquiry:   (id, data) => request(`/enquiries/${id}`, { method: 'PATCH', body: data }),

  // Quotations
  listQuotations:  () => request('/quotations'),
  getQuotation:    (id) => request(`/quotations/${id}`),
  createQuotation: (data) => request('/quotations', { method: 'POST', body: data }),
  updateQuotationStatus: (id, status) =>
    request(`/quotations/${id}/status`, { method: 'PATCH', body: { status } }),

  // Orders
  listOrders:      () => request('/orders'),
  getOrder:        (id) => request(`/orders/${id}`),
  convertQuotationToOrder: (id) =>
    request(`/orders/quotations/${id}/convert`, { method: 'POST' }),
  confirmOrder:    (id) => request(`/orders/${id}/confirm`, { method: 'POST' }),
  dispatchOrder:   (id, data) =>
    request(`/dispatches/sales-orders/${id}/dispatch`, { method: 'POST', body: data }),

  // Inventory
  listInventory:   () => request('/inventory'),

  // Master data (for dropdowns)
  listProducts:    () => request('/products'),
  createProduct:  (data) => request('/products', { method: 'POST', body: data }),
  updateProduct:  (id, data) => request(`/products/${id}`, { method: 'PATCH', body: data }),
  deleteProduct:  (id) => request(`/products/${id}`, { method: 'DELETE' }),
  listCustomers:   () => request('/customers'),
  createCustomer: (data) => request('/customers', { method: 'POST', body: data }),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PATCH', body: data }),
  deactivateCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
};