import { z } from "zod";

export const bookedAppointmentSchema = z.object({
  patientid: z.string(),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;
export const bookedAppointmentsSchema = z.object({
  appointments: bookedAppointmentSchema.array(),
});
export type BookedAppointments = z.infer<typeof bookedAppointmentsSchema>;

const appointmentEventSchema = z.object({
  patientid: z.string().optional(),
  appointmentstatus: z.string(),
});
export type AppointmentEvent = z.infer<typeof appointmentEventSchema>;
export const appointmentEventsSchema = z.object({
  appointments: appointmentEventSchema.array(),
});
export type AppointmentEvents = z.infer<typeof appointmentEventsSchema>;
