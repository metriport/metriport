import { BaseDomain, BaseDomainCreate } from "../../domain/base-domain";
import { DocumentQueryProgress } from "../../domain/medical/document-query";
import { z } from "zod";

// TODO Can have x bytes. Dont allow for anything to get in.
export type RequestMetadata = {
  data: { [key: string]: string }; // dictionary with properties of type string.
};

// TODO move this to the domain folder
export interface RequestCreate extends BaseDomainCreate {
  cxId: string;
  patientId: string;
  facilityIds: string[];
  metadata?: RequestMetadata;
  documentQueryProgress?: DocumentQueryProgress;
}

export const requestMetadataDataSchemaOptional = z.object({
  data: z.record(z.string()).optional(),
});

export const requestMetadataDataSchemaRequired = z.object({
  data: z.record(z.string()).refine(data => Object.keys(data).length > 0, {
    message: "Data object cannot be empty",
  }),
});

export interface Request extends BaseDomain, RequestCreate {}
