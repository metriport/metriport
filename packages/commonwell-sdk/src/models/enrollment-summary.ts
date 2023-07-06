import { z } from "zod";
import { isoDateSchema } from "./iso-date";
import { isoDateTimeSchema } from "./iso-datetime";

// A summary of a Person’s enrollment status.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.9 EnrollmentSummary)
export const enrollmentSummarySchema = z.object({
  dateEnrolled: isoDateTimeSchema.or(isoDateSchema),
  enroller: z.string(),
  dateUnenrolled: isoDateTimeSchema.or(isoDateSchema).optional().nullable(),
  unenroller: z.string().optional().nullable(),
});

export type EnrollmentSummary = z.infer<typeof enrollmentSummarySchema>;
