export const list = (_req, res) => res.json({ success: true, data: [] });
export const getById = (_req, res) => res.status(404).json({ error: 'Product not found' });
export const create = (_req, res) => res.status(501).json({ error: 'Product creation not implemented' });
export const update = (_req, res) => res.status(501).json({ error: 'Product update not implemented' });
export const remove = (_req, res) => res.status(501).json({ error: 'Product deletion not implemented' });
export const deleteProduct = remove;
