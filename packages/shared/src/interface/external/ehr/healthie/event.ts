import { z } from "zod";

export const healthieAppointmentCreatedEventSchema = z.object({
  resource_id: z.coerce.string(),
  resource_type_id: z.string(),
  event_type: z.literal("appointment.created"),
});
export type HealthieAppointmentCreatedEvent = z.infer<typeof healthieAppointmentCreatedEventSchema>;

export const healthiePatientCreatedEventSchema = z.object({
  resource_id: z.coerce.string(),
  resource_type_id: z.string(),
  event_type: z.literal("patient.created"),
});
export type HealthiePatientCreatedEvent = z.infer<typeof healthiePatientCreatedEventSchema>;
