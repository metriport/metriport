import { Resource } from "@medplum/fhirtypes";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type ResourceWithId = Omit<Resource, "id"> & { id: string };

export type ProcessResourceDiffRequest = {
  ehr: EhrSource;
  cxId: string;
  patientId: string;
  existingResources: ResourceWithId[];
  newResource: ResourceWithId;
  direction: ResourceDiffDirection;
};

export interface EhrResourceDifftHandler {
  processResourceDiff(request: ProcessResourceDiffRequest): Promise<void>;
}
