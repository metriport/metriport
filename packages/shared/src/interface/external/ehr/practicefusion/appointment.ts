import { z } from "zod";

export const appointmentTypeSchema = z.object({
  eventCategory: z.enum(["Appointment", "BlockedTime"]),
});

export const appointmentSchema = z.object({
  eventId: z.string(),
  patientPracticeGuid: z.string().optional(),
  eventType: appointmentTypeSchema,
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const bookedAppointmentSchema = z.object({
  patientId: z.string(),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;

// Single event response: GET /events/{eventId}
export const appointmentRefSchema = z.object({
  event: appointmentSchema,
});

// Query response: GET /events/query - events are NOT wrapped
export const appointmentsQueryResultSchema = z.object({
  meta: z
    .object({
      nextPageToken: z.string().optional(),
    })
    .optional(),
  events: appointmentSchema.array(),
});
export type AppointmentsQueryResult = z.infer<typeof appointmentsQueryResultSchema>;
