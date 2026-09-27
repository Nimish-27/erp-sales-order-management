const BASE = '/api';

const request = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // send httpOnly cookie automatically
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

const requestAllPages = async (path) => {
  const firstPage = await request(`${path}?page=1&limit=100`);
  const allData = [...(firstPage.data ?? [])];
  const totalPages = firstPage.pagination?.totalPages ?? 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const result = await request(`${path}?page=${page}&limit=100`);
    allData.push(...(result.data ?? []));
  }
  return { ...firstPage, data: allData };
};

export const api = {
  // Auth
  login:    (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout:   () => request('/auth/logout', { method: 'POST' }),
  register: (email, password, role) => request('/auth/register', { method: 'POST', body: { email, password, role } }),
  me:       () => request('/auth/me'),

  // Enquiries
  listEnquiries:   () => requestAllPages('/enquiries'),
  getEnquiry:      (id) => request(`/enquiries/${id}`),
  createEnquiry:   (data) => request('/enquiries', { method: 'POST', body: data }),
  updateEnquiry:   (id, data) => request(`/enquiries/${id}`, { method: 'PATCH', body: data }),

  // Quotations
  listQuotations:  () => requestAllPages('/quotations'),
  getQuotation:    (id) => request(`/quotations/${id}`),
  createQuotation: (data) => request('/quotations', { method: 'POST', body: data }),
  updateQuotationStatus: (id, status) =>
    request(`/quotations/${id}/status`, { method: 'PATCH', body: { status } }),

  // Orders
  listOrders:      () => requestAllPages('/orders'),
  getOrder:        (id) => request(`/orders/${id}`),
  convertQuotationToOrder: (id) =>
    request(`/orders/quotations/${id}/convert`, { method: 'POST' }),
  confirmOrder:    (id) => request(`/orders/${id}/confirm`, { method: 'POST' }),
  cancelOrder:     (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),
  dispatchOrder:   (id, data) =>
    request(`/dispatches/sales-orders/${id}/dispatch`, { method: 'POST', body: data }),

  // Inventory
  listInventory:   () => request('/inventory'),
  updateDamagedQuantity: (productId, damagedQty) =>
    request(`/inventory/${productId}/damaged`, { method: 'PATCH', body: { damagedQty } }),

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
