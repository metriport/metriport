import { AthenaSource, AthenaCxMappingParams, AthenaJwtTokenParams } from "./athenahealth/shared";

export enum EhrSources {
  athena = "athenahealth",
}

export type EhrSource = AthenaSource;
export type EhrCxMappingParams = AthenaCxMappingParams;
export type EhrJwtTokenParams = AthenaJwtTokenParams;
