import { BaseDomain } from "@metriport/core/domain/base-domain";
import { ehrSources } from "@metriport/shared/interface/external/ehr/source";

const resourceMappingSource = [...ehrSources] as const;
export type ResourceMappingReversedSource = (typeof resourceMappingSource)[number];
export function isResourceMappingReversedSource(
  source: string
): source is ResourceMappingReversedSource {
  return resourceMappingSource.includes(source as ResourceMappingReversedSource);
}

export type ResourceMappingReversedPerSource = {
  externalId: string;
  cxId: string;
  patientId: string;
  patientMappingExternalId: string;
  resourceId: string;
  source: ResourceMappingReversedSource;
};

export interface ResourceMappingReversed extends BaseDomain, ResourceMappingReversedPerSource {}
