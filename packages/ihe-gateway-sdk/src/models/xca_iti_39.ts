import { documentReference, baseRequestSchema } from "./shared";

import { z } from "zod";

export const xcaIti39Request = z.array(
  baseRequestSchema.extend({
    xcaGateway: z.string(),
    homeCommunityId: z.string(),
    documentReference: z.array(documentReference),
  })
);

export type XCA_ITI_39Request = z.infer<typeof xcaIti39Request>;

// STILL WAITING ON RESPONSE
// https://www.notion.so/metriport/XCA-ITI-39-Interface-DR-593b06be795e46458eb1530dd9a7b822
