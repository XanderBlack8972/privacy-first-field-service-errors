import { z } from "zod";
import type { ExceptionPayload } from "./infrai_errors.js";

export const workOrderFailureSchema = z.object({
  workOrderId: z.string().min(1).max(80),
  dispatchStatus: z.enum(["assigned", "en_route", "on_site", "completed"]),
  followUp: z.enum(["none", "call_technician", "reschedule", "clinical_review"]),
  photoCount: z.number().int().min(0).max(50),
  errorName: z.string().min(1).max(120),
  errorMessage: z.string().min(1).max(500),
  technicianId: z.string().min(1).max(80).optional(),
  photoUrls: z.array(z.string().url()).max(50).optional(),
  patientNote: z.string().max(1000).optional(),
});

export type WorkOrderFailure = z.infer<typeof workOrderFailureSchema>;

export function toExceptionPayload(input: WorkOrderFailure): ExceptionPayload {
  return {
    title: `Work order ${input.dispatchStatus} failed`,
    message: `${input.errorName}: ${input.errorMessage}`,
    level: "error",
    fingerprint: ["field-service", input.workOrderId, input.dispatchStatus, input.followUp],
    exception: `${input.errorName}: ${input.errorMessage}`,
    context: {
      workOrderId: input.workOrderId,
      dispatchStatus: input.dispatchStatus,
      followUp: input.followUp,
      photoCount: input.photoCount,
    },
  };
}
