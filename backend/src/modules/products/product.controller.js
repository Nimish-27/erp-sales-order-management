import { prisma } from '../../config/db.js';
import { httpError } from '../../shared/errors.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';

export const list = async (req, res) => {
	const { page, limit, skip } = parsePagination(req.query);
	const where = { isActive: true };
	const [products, total] = await Promise.all([
		prisma.product.findMany({
			where,
			orderBy: { productCode: 'asc' },
			skip,
			take: limit,
			select: { id: true, productCode: true, name: true, category: true, unit: true, basePrice: true, gstPercent: true },
		}),
		prisma.product.count({ where }),
	]);
	res.json({ success: true, ...paginatedResponse(products, total, page, limit) });
};
export const getById = async (req, res) => {
	const product = await prisma.product.findUnique({ where: { id: req.params.id } });
	if (!product) throw httpError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
	res.json({ success: true, data: product });
};

export const create = async (req, res) => {
	const {
		productCode,
		name,
		category,
		unit,
		basePrice,
		gstPercent = 18,
		physicalQty = 0,
		reorderLevel = 0,
	} = req.body;
	if (!productCode || !name || !category || !unit || basePrice === undefined) {
		throw httpError(400, 'productCode, name, category, unit, and basePrice are required', 'VALIDATION_ERROR');
	}

	try {
		const product = await prisma.$transaction(async (tx) => {
			const createdProduct = await tx.product.create({
				data: { productCode, name, category, unit, basePrice, gstPercent },
			});
			await tx.inventory.create({
				data: { productId: createdProduct.id, physicalQty, reservedQty: 0, reorderLevel },
			});
			return createdProduct;
		});
		res.status(201).json({ success: true, data: product });
	} catch (error) {
		if (error.code === 'P2002') throw httpError(409, 'Product code already exists', 'PRODUCT_CODE_EXISTS');
		throw error;
	}
};

export const update = async (req, res) => {
	const { productCode, name, category, unit, basePrice, gstPercent, isActive } = req.body;
	try {
		const product = await prisma.product.update({
			where: { id: req.params.id },
			data: { productCode, name, category, unit, basePrice, gstPercent, isActive },
		});
		res.json({ success: true, data: product });
	} catch (error) {
		if (error.code === 'P2025') throw httpError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
		if (error.code === 'P2002') throw httpError(409, 'Product code already exists', 'PRODUCT_CODE_EXISTS');
		throw error;
	}
};

export const remove = async (req, res) => {
	try {
		await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
		res.status(204).send();
	} catch (error) {
		if (error.code === 'P2025') throw httpError(404, 'Product not found', 'PRODUCT_NOT_FOUND');
		throw error;
	}
};
export const deleteProduct = remove;
