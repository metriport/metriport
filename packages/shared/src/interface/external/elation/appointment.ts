import { z } from "zod";

export const bookedAppointmentSchema = z.object({
  patient: z.coerce.string(),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;

export const appointmentSchema = z.object({
  patient: z.coerce.string().nullable(),
  status: z.object({ status: z.string() }).nullable(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const appointmentsSchema = z.object({
  results: appointmentSchema.array(),
});
export type Appointments = z.infer<typeof appointmentsSchema>;
