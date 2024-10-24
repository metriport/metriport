import { z } from "zod";

export const geoCoordinateSchema = z.object({
  lat: z.number(),
  lon: z.number(),
});
