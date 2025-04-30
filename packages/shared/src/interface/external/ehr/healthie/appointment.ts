import { z } from "zod";

export const appointmentSchema = z.object({
  id: z.string(),
  attendees: z.object({ id: z.string() }).array(),
  appointment_type: z.object({ id: z.string() }).nullable(),
  cursor: z.string(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export type AppointmentAttendee = Appointment["attendees"][number];
export type AppointmentWithAttendee = Appointment & {
  attendees: [AppointmentAttendee, ...AppointmentAttendee[]];
};

export const appointmentGetResponseGraphqlSchema = z.object({
  data: z.object({
    appointment: appointmentSchema.nullable(),
  }),
});
export type AppointmentGetResponseGraphql = z.infer<typeof appointmentGetResponseGraphqlSchema>;

export const appointmentListResponseGraphqlSchema = z.object({
  data: z.object({
    appointments: appointmentSchema.array(),
  }),
});
export type AppointmentListResponseGraphql = z.infer<typeof appointmentListResponseGraphqlSchema>;
