import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .transform((s) => new Date(`${s}T00:00:00.000Z`))
  .refine((d) => !isNaN(d.getTime()), 'Invalid date');

const uuid = z.string().uuid('Must be a valid UUID');
const statusEnum = (...values) => z.enum(values).optional();
const pageSchema = z.coerce.number().int().positive().optional();

export const enquiryQuerySchema = z.object({
  customerId: uuid.optional(),
  status:     statusEnum('OPEN', 'QUOTED', 'CLOSED', 'CANCELLED'),
  fromDate:   isoDate.optional(),
  toDate:     isoDate.optional(),
  page:       pageSchema,
  limit:      pageSchema,
});

export const quotationQuerySchema = z.object({
  customerId: uuid.optional(),
  enquiryId:  uuid.optional(),
  status:     statusEnum('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'),
  page:       pageSchema,
  limit:      pageSchema,
});

export const orderQuerySchema = z.object({
  customerId: uuid.optional(),
  status:     statusEnum('CREATED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'),
  fromDate:   isoDate.optional(),
  toDate:     isoDate.optional(),
  page:       pageSchema,
  limit:      pageSchema,
});

export const validateQuery = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return next({ status: 400, code: 'INVALID_QUERY', message: 'Invalid query parameters', details: result.error.flatten() });
  }
  req.query = result.data;
  next();
};
