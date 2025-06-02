import {
  AthenaSecondaryMappings,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import {
  ElationSecondaryMappings,
  elationSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import {
  HealthieSecondaryMappings,
  healthieSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { z } from "zod";

export type EhrCxMappingSecondaryMappings =
  | AthenaSecondaryMappings
  | ElationSecondaryMappings
  | HealthieSecondaryMappings;
export const ehrCxMappingSecondaryMappingsSchemaMap: {
  [key in EhrSource]: z.Schema | undefined;
} = {
  [EhrSources.athena]: athenaSecondaryMappingsSchema,
  [EhrSources.elation]: elationSecondaryMappingsSchema,
  [EhrSources.canvas]: undefined,
  [EhrSources.healthie]: healthieSecondaryMappingsSchema,
  [EhrSources.eclinicalworks]: undefined,
  [EhrSources.touchworks]: undefined,
};
