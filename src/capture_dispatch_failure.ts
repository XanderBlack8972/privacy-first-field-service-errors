import { captureException } from "./infrai_errors.js";
import { toExceptionPayload, workOrderFailureSchema } from "./work_order_error.js";

const failure = workOrderFailureSchema.parse({
  workOrderId: "wo-1842",
  dispatchStatus: "on_site",
  followUp: "call_technician",
  photoCount: 3,
  errorName: "PhotoUploadError",
  errorMessage: "Consent photo upload was interrupted",
});

const event = await captureException(toExceptionPayload(failure), {
  idempotencyKey: `wo-1842:on_site:photo-upload`,
});

console.log(JSON.stringify({ captured: true, event }, null, 2));
