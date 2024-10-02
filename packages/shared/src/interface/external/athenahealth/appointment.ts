import { z } from "zod";

const bookedAppointmentSchema = z.object({
  patientid: z.string().optional(),
  appointmentstatus: z.enum(["o", "f", "x", "2", "3", "4"]),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;
export const bookedAppointmentsGetResponseSchema = z.object({
  appointments: bookedAppointmentSchema.array(),
});
