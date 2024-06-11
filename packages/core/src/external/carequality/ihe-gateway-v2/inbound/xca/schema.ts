import { z } from "zod";
import { schemaOrArray, samlHeaderSchema, slot, StringOrNumberSchema } from "../../schema";

export const iti38RequestBody = z.object({
  AdhocQueryRequest: z.object({
    ResponseOption: z.object({
      _returnComposedObjects: z.literal("true"),
      _returnType: z.literal("LeafClass"),
    }),
    AdhocQuery: z.object({
      Slot: schemaOrArray(slot),
    }),
  }),
});

export const iti38RequestSchema = z.object({
  Envelope: z.object({
    Header: samlHeaderSchema,
    Body: iti38RequestBody,
  }),
});
export type Iti38Request = z.infer<typeof iti38RequestSchema>;

export const DocumentRequest = z.object({
  DocumentUniqueId: StringOrNumberSchema,
  RepositoryUniqueId: StringOrNumberSchema,
  HomeCommunityId: StringOrNumberSchema,
});

export const iti39RequestBody = z.object({
  RetrieveDocumentSetRequest: z.object({
    DocumentRequest: schemaOrArray(DocumentRequest),
  }),
});

export const iti39RequestSchema = z.object({
  Envelope: z.object({
    Header: samlHeaderSchema,
    Body: iti39RequestBody,
  }),
});
export type Iti39Request = z.infer<typeof iti39RequestSchema>;
