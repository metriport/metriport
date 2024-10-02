import { z } from "zod";

const bookedAppointmentSchema = z.object({
  patientid: z.string(),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;
export const bookedAppointmentsGetResponseSchema = z.object({
  appointments: bookedAppointmentSchema.array(),
});
