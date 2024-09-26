import { z } from "zod";
import { athenaSecondaryMappingsSchema, AthenaSecondaryMappings } from "@metriport/shared";
import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type CxSources = CxMappingPerSource["source"];
export type CxSecondaryMappings = CxMappingPerSource["secondaryMappings"];

export const cxMappingsSourceMap: { [k: string]: { bodyParser: z.Schema } | undefined } = {
  [EhrSources.ATHENA]: { bodyParser: athenaSecondaryMappingsSchema },
};

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
} & {
  source: EhrSources.ATHENA;
  secondaryMappings: AthenaSecondaryMappings | null;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
