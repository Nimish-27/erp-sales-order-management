import { app } from './app.js';
import { env } from './config/env.js';
import { sweepExpiredReservations } from './modules/reservations/expiry.sweeper.js';
import { prisma } from './config/db.js';

app.listen(env.PORT, () => {
  console.log(`Inventory backend listening on port ${env.PORT}`);

  // Expire SENT quotations whose validUntil has passed
  const expireQuotations = async () => {
    const { count } = await prisma.quotation.updateMany({
      where: { status: 'SENT', validUntil: { lt: new Date() } },
      data:  { status: 'EXPIRED' },
    });
    if (count > 0) console.log(`[scheduler] Expired ${count} quotation(s)`);
  };

  // Sweep orphaned reservations (safety net for partial failures)
  const sweepReservations = async () => {
    const { swept } = await sweepExpiredReservations();
    if (swept > 0) console.log(`[sweeper] Released ${swept} orphaned reservation(s)`);
  };

  const runScheduled = async (name, fn) => {
    try { await fn(); }
    catch (err) { console.error(`[${name}] Error:`, err.message); }
  };

  // Run immediately on startup, then every 5 minutes
  runScheduled('expireQuotations', expireQuotations);
  runScheduled('sweepReservations', sweepReservations);

  setInterval(() => runScheduled('expireQuotations', expireQuotations), 5 * 60 * 1000);
  setInterval(() => runScheduled('sweepReservations', sweepReservations), 5 * 60 * 1000);
});
