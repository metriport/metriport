import { z } from "zod";

export const appointmentSchema = z.object({
  id: z.string(),
  attendees: z
    .array(
      z.object({
        id: z.string(),
      })
    )
    .min(1),
  appointment_type: z.object({
    id: z.string(),
  }),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export type AppointmentAttendee = Appointment["attendees"][number];
export type AppointmentWithAttendee = Appointment & {
  attendees: [AppointmentAttendee, ...AppointmentAttendee[]];
};
export const appointmentListResponseSchema = z.object({
  appointments: appointmentSchema.array(),
});
export type AppointmentListResponse = z.infer<typeof appointmentListResponseSchema>;

export const appointmentListGraphqlResponseSchema = z.object({
  data: appointmentListResponseSchema,
});
export type AppointmentListGraphqlResponse = z.infer<typeof appointmentListGraphqlResponseSchema>;
