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

export const appointmentGetResponseSchema = z.object({
  appointment: appointmentSchema.nullable(),
});
export type AppointmentGetResponse = z.infer<typeof appointmentGetResponseSchema>;
export const appointmentGetResponseGraphqlSchema = z.object({
  data: appointmentGetResponseSchema,
});
export type AppointmentGetResponseGraphql = z.infer<typeof appointmentGetResponseGraphqlSchema>;

export const appointmentListResponseSchema = z.object({
  appointments: appointmentSchema.array().nullable(),
});
export type AppointmentListResponse = z.infer<typeof appointmentListResponseSchema>;
export const appointmentListResponseGraphqlSchema = z.object({
  data: appointmentListResponseSchema,
});
export type AppointmentListResponseGraphql = z.infer<typeof appointmentListResponseGraphqlSchema>;
