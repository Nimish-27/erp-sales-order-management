import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { dispatchService } from './dispatch.service.js';
import { audit } from '../../shared/audit.js';

export const createDispatch = asyncHandler(async (req, res) => {
  const dispatch = await dispatchService.createDispatch(req.params.id, {
    vehicleNumber: req.vehicleNumber,
    driverName:    req.driverName,
  });
  audit(req, 'ORDER_DISPATCHED', 'Dispatch', dispatch.id, {
    newValue: { dispatchNumber: dispatch.dispatchNumber, salesOrderId: req.params.id },
  });
  res.status(201).json({ success: true, data: dispatch });
});

export const updateDispatchStatus = asyncHandler(async (req, res) => {
  const dispatch = await dispatchService.transitionStatus(req.params.id, req.body.status);
  audit(req, `DISPATCH_${req.body.status}`, 'Dispatch', dispatch.id, {
    newValue: { status: req.body.status },
  });
  res.json({ success: true, data: dispatch });
});
