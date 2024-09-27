import { z } from "zod";
import { BaseDomain } from "@metriport/core/domain/base-domain";

export type CxMappingSource = CxMappingParams["source"];
export type CxMappingSecondaryMappings = CxMappingParams["secondaryMappings"];
export type CxMappingBodyParser = { bodyParser: z.Schema };

export interface CxMappingParams {
  externalId: string;
  cxId: string;
  source: string;
  secondaryMappings: unknown | null;
}

export interface CxMapping extends BaseDomain, CxMappingParams {}
