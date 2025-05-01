import { z } from "zod";

export const slimBookedAppointmentSchema = z.object({
  patientId: z.string(),
});
export type SlimBookedAppointment = z.infer<typeof slimBookedAppointmentSchema>;

export const appointmentSchema = z.object({
  resourceType: z.literal("Appointment"),
  participant: z
    .object({
      actor: z.object({
        reference: z.string(),
        type: z.enum(["Patient", "Practitioner"]),
      }),
    })
    .array(),
  status: z.string(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const appointmentListResponseSchema = z.object({
  entry: z.object({ resource: appointmentSchema }).array().optional(),
  link: z.object({ relation: z.string(), url: z.string() }).array().optional(),
});
export type AppointmentListResponse = z.infer<typeof appointmentListResponseSchema>;
