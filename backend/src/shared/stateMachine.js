export const OrderTransitions = {
  CREATED:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED:   ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED:  [],
};

export const ReservationTransitions = {
  PENDING:   ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: [],
  CANCELLED: [],
  EXPIRED:   [],
};

export const assertTransition = (machine, from, to) => {
  const allowed = machine[from];
  if (!allowed) {
    const err = new Error(`Unknown current state: ${from}`);
    err.status = 500;
    throw err;
  }
  if (!allowed.includes(to)) {
    const err = new Error(`Invalid transition: ${from} → ${to}. Allowed: [${allowed.join(', ') || 'none'}]`);
    err.status = 409;
    throw err;
  }
};