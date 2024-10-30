import { z } from "zod";

const bookedAppointmentSchema = z.object({
  patientid: z.string(),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;
export const bookedAppointmentsGetResponseSchema = z.object({
  appointments: bookedAppointmentSchema.array(),
});

const appointmentEventSchema = z.object({
  patientid: z.string().optional(),
  appointmentstatus: z.string(),
});
export const appointmentEventGetResponseSchema = z.object({
  appointments: appointmentEventSchema.array(),
});
