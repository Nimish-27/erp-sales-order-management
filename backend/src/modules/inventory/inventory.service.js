import { assertTransition, OrderTransitions } from '../../shared/stateMachine.js';

export const updateOrderStatus = async (orderId, newStatus, actorRole) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw httpError(404, 'Order not found');

  // RBAC check tied to transition
  const restricted = ['SHIPPED', 'DELIVERED', 'RETURNED'];
  if (restricted.includes(newStatus) && actorRole !== 'ADMIN' && actorRole !== 'MANAGER') {
    throw httpError(403, 'Insufficient role to perform this transition');
  }

  assertTransition(OrderTransitions, order.status, newStatus);

  return prisma.order.update({ where: { id: orderId }, data: { status: newStatus } });
};