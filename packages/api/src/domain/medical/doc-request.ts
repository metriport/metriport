import { BaseDomain, BaseDomainCreate } from "../base-domain";
import { DocumentQueryProgress } from "./document-query";
import { z } from "zod";

// TODO Can have x bytes. Dont allow for anything to get in.
export type DocRequestMetadata = {
  data: { [key: string]: string }; // dictionary with properties of type string.
};

// TODO move this to the domain folder
export interface DocRequestCreate extends BaseDomainCreate {
  cxId: string;
  patientId: string;
  facilityIds: string[];
  metadata: DocRequestMetadata;
  documentQueryProgress: DocumentQueryProgress;
}

export const docRequestMetadataDataSchemaOptional = z.object({
  data: z.record(z.string()).optional(),
});

export const docRequestMetadataDataSchemaRequired = z.object({
  data: z.record(z.string()).refine(data => Object.keys(data).length > 0, {
    message: "Data object cannot be empty",
  }),
});

export interface DocRequest extends BaseDomain, DocRequestCreate {}
