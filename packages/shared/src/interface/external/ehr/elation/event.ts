import { z } from "zod";

export const elationAppointmentEventSchema = z.object({
  event_id: z.coerce.string(),
  application_id: z.string(),
  resource: z.literal("appointments"),
  action: z.enum(["saved", "deleted"]),
  data: z.object({
    id: z.coerce.string(),
    patient: z.coerce.string(),
    created_date: z.string(),
    last_modified_date: z.string(),
    status: z.object({
      status: z.string(),
    }),
  }),
});
export type ElationAppointmentEvent = z.infer<typeof elationAppointmentEventSchema>;

export const elationPatientEventSchema = z.object({
  event_id: z.coerce.string(),
  application_id: z.string(),
  resource: z.literal("patients"),
  action: z.enum(["saved", "deleted"]),
  data: z.object({
    id: z.coerce.string(),
    created_date: z.string(),
    last_modified: z.string(),
  }),
});
export type ElationPatientEvent = z.infer<typeof elationPatientEventSchema>;
