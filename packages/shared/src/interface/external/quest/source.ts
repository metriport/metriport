import { z } from "zod";

export const questSource = "quest";

export const questMappingRequestSchema = z.object({ externalId: z.string() });
