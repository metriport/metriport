import { z } from "zod";

export const bookedAppointmentSchema = z.object({
  patientid: z.string(),
  departmentid: z.string(),
  appointmenttypeid: z.string(),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;
export const bookedAppointmentListResponseSchema = z.object({
  appointments: bookedAppointmentSchema.array(),
  next: z.string().optional(),
});
export type BookedAppointmentListResponse = z.infer<typeof bookedAppointmentListResponseSchema>;

const appointmentEventSchema = z.object({
  patientid: z.string().optional(),
  departmentid: z.string(),
  appointmentstatus: z.string(),
  appointmenttypeid: z.string(),
});
export type AppointmentEvent = z.infer<typeof appointmentEventSchema>;
export const appointmentEventListResponseSchema = z.object({
  appointments: appointmentEventSchema.array(),
  next: z.string().optional(),
});
export type AppointmentEventListResponse = z.infer<typeof appointmentEventListResponseSchema>;
