// (Required) homeCommunityId - identifies the community holding the document
// (Required) repositoryUniqueId - identifies the repository from which the document is to be retrieved.
// (Required) documentUniqueId - identifies the document within the repository

import { z } from "zod";

export const xcaIti39PayloadSchema = z.array(
  z.object({
    homeCommunityId: z.string(),
    repositoryUniqueId: z.string(),
    documentUniqueId: z.string(),
  })
);

export type XCA_ITI_39Request = z.infer<typeof xcaIti39PayloadSchema>;
