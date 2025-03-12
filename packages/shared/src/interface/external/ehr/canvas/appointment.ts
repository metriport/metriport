import { z } from "zod";

export const slimBookedAppointmentSchema = z.object({
  patientId: z.string(),
});
export type SlimBookedAppointment = z.infer<typeof slimBookedAppointmentSchema>;

export const bookedAppointmentSchema = z.object({
  resourceType: z.literal("Appointment"),
  participant: z
    .object({
      actor: z.object({
        reference: z.string(),
        type: z.enum(["Patient", "Practitioner"]),
      }),
    })
    .array(),
  status: z.literal("booked"),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;
export const bookedAppointmentsSchema = z.object({
  entry: z.object({ resource: bookedAppointmentSchema }).array(),
});
export type BookedAppointments = z.infer<typeof bookedAppointmentsSchema>;
