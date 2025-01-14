import { z } from "zod";

const appointmentSchema = z.object({
  patient: z.coerce.string().nullable(),
  status: z
    .object({
      status: z.string(),
    })
    .nullable(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const appointmentsGetResponseSchema = z.object({
  results: appointmentSchema.array(),
});
