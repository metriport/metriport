import { athenaSecondaryMappingsSchema } from "@metriport/shared";
import { CxMappingBodyParser } from "../../domain/cx-mapping";
import { AthenaSource, AthenaCxMappingParams, AthenaJwtTokenParams } from "./athenahealth/shared";

export enum EhrSources {
  athena = "athenahealth",
}

export type EhrSource = AthenaSource;
export type EhrCxMappingParams = AthenaCxMappingParams;
export type EhrJwtTokenParams = AthenaJwtTokenParams;

export const ehrCxMappingSourceMap: Map<EhrSource, CxMappingBodyParser> = new Map([
  [EhrSources.athena, { bodyParser: athenaSecondaryMappingsSchema }],
]);

export const ehrFacilityMappingSourceList: EhrSource[] = [EhrSources.athena];
