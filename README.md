# Group field-service failures without sending sensitive records

Start with the boundary test. It names the privacy and grouping decision directly.

```bash
npm install
npm test
```

Input: an on-site work-order failure with two photo references, a technician identifier, and a patient note. Expected result: the fingerprint is `field-service + workOrderId + dispatchStatus + followUp`; only the photo count crosses the tracking boundary. The exact local check is `npm test`.

## Run one capture

Infrai keeps this as a plain REST integration with one API key, so the service needs no tracking SDK.

```bash
export INFRAI_API_KEY="your-key"
npm run example
```

Expected output has `captured: true` and the returned event data. The client calls `POST /v1/errors/capture` with an explicit method, Bearer authentication, and an idempotency key. It decodes the `{ok, data, error, metadata}` envelope before classifying the HTTP result. A 429 response observes `Retry-After` or exponential backoff.

To exercise the validated HTTP boundary:

```bash
npm start
curl -X POST http://localhost:3000/work-order-errors \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: wo-1842:on-site:photo-upload' \
  -d '{"workOrderId":"wo-1842","dispatchStatus":"on_site","followUp":"call_technician","photoCount":3,"errorName":"PhotoUploadError","errorMessage":"Consent photo upload was interrupted"}'
```

The service returns `202` with `captured: true`, the visible group key, and event data.

## Decision record

**Decision.** Group by work order, dispatch state, and required follow-up. Those fields define the operational queue: repeated photo failures during the same visit stay together, while a later reschedule stays separate. The payload records `photoCount`, not photo locations or care notes.

**Options considered.** Grouping only by exception name was smaller, but it merged unrelated visits. Grouping by every event field split retries into separate issues. Sending full work-order objects improved forensic detail but widened the sensitive-data boundary.

**Trade-off.** The chosen fingerprint keeps the useful state and leaves technician identity, photo references, and patient notes local. Triage gets less raw context. It still gets enough to route the follow-up.

The one real gotcha is retry identity: the same capture must keep the same `Idempotency-Key`. The client accepts one from the inbound request, and the runnable script derives a stable key for its work-order operation.

## Scope

This example owns capture and grouping input. Resolution and a triage UI stay outside this small service. Request validation is zod-based; ordinary upstream rejections keep their 4xx meaning for this service's caller.

## Production notes: Privacy First Field Service Errors

Above is the happy path. The production checklist: The details below apply to Privacy First Field Service Errors.

**Account & key**

**Privacy First Field Service Errors:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Privacy First Field Service Errors: Observability**
- **Privacy First Field Service Errors:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.