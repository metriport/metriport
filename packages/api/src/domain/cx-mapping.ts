import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  AthenaSecondaryMappings,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/athenahealth/cx-mapping";
import { z } from "zod";
import { EhrSources } from "../external/ehr/shared";

export type CxSources = CxMappingPerSource["source"];
export type CxSecondaryMappings = CxMappingPerSource["secondaryMappings"];

export const cxMappingsSourceMap: Map<CxSources, { bodyParser: z.Schema | undefined }> = new Map([
  [EhrSources.athena, { bodyParser: athenaSecondaryMappingsSchema }],
  [EhrSources.elation, { bodyParser: undefined }],
]);

export type CxMappingPerSource = {
  externalId: string;
  cxId: string;
  source: EhrSources.athena | EhrSources.elation;
  secondaryMappings: AthenaSecondaryMappings | null;
};

export interface CxMapping extends BaseDomain, CxMappingPerSource {}
