## Quotation Status Transitions

**Assumption:** Strict sequential transitions enforced at the API level.

| Current Status | Allowed Next Status | Notes |
|----------------|---------------------|-------|
| `DRAFT`        | `SENT`              | Initial editable state |
| `SENT`         | `ACCEPTED`, `REJECTED` | Sent to customer; can be accepted or rejected |
| `ACCEPTED`     | *(terminal)*        | Ready for Sales Order creation |
| `REJECTED`     | *(terminal)*        | Closed |
| `EXPIRED`      | *(terminal)*        | Set by background job when `validUntil` passes |

**Illegal transitions return 409:** e.g., `DRAFT → ACCEPTED` directly is rejected. Client must send `DRAFT → SENT → ACCEPTED`.

This is enforced in `quotation.service.ts` via the `TRANSITIONS` map.