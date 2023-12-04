import { z } from "zod";

// https://tenovi.com/api-docs/#:~:text=Measurement%20Webhooks-,Measurement%20Webhooks,-The%20Tenovi%20Logistics

export const tenoviMeasurementSchema = z.object({
  metric: z.string(),
  device_name: z.string(),
  hwi_device_id: z.string(),
  patient_id: z.string(),
  hardware_uuid: z.string(),
  sensor_code: z.string(),
  value_1: z.union([z.string(), z.number()]),
  value_2: z.union([z.string(), z.number()]).nullable(),
  created: z.string(),
  timestamp: z.string(),
  timezone_offset: z.number(),
  estimated_timestamp: z.boolean(),
});

export const tenoviMeasurementDataSchema = z.array(tenoviMeasurementSchema);

export type TenoviMeasurementData = z.infer<typeof tenoviMeasurementDataSchema>;
export type TenoviMeasurement = z.infer<typeof tenoviMeasurementSchema>;
