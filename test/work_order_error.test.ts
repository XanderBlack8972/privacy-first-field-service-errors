import assert from "node:assert/strict";
import test from "node:test";
import { toExceptionPayload, workOrderFailureSchema } from "../src/work_order_error.js";

test("groups a repeat failure by work order state and excludes sensitive detail", () => {
  const input = workOrderFailureSchema.parse({
    workOrderId: "wo-1842",
    dispatchStatus: "on_site",
    followUp: "clinical_review",
    photoCount: 2,
    errorName: "PhotoUploadError",
    errorMessage: "Upload interrupted",
    technicianId: "tech-private-7",
    photoUrls: ["https://private.example/consent-photo.jpg"],
    patientNote: "Patient requested a private follow-up",
  });

  const payload = toExceptionPayload(input);
  assert.deepEqual(payload.fingerprint, ["field-service", "wo-1842", "on_site", "clinical_review"]);
  assert.equal(payload.context.photoCount, 2);
  assert.equal(JSON.stringify(payload).includes("tech-private-7"), false);
  assert.equal(JSON.stringify(payload).includes("consent-photo.jpg"), false);
  assert.equal(JSON.stringify(payload).includes("Patient requested"), false);
});
