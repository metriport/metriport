import { z } from "zod";

export const userDevicesSchema = z
  .array(
    z.object({
      type: z.string().optional().nullable(),
      battery: z.string().optional().nullable(),
      model: z.string().optional().nullable(),
      model_id: z.number().optional().nullable(),
      timezone: z.string().optional().nullable(),
      first_session_date: z.number().optional().nullable(),
      last_session_date: z.number().optional().nullable(),
      deviceid: z.string().optional().nullable(),
      hash_deviceid: z.string().optional().nullable(),
    })
  )
  .nullish();

export type WithingsUserDevices = z.infer<typeof userDevicesSchema>;
