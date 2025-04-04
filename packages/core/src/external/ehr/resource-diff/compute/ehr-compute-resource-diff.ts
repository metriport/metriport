import { Resource } from "@medplum/fhirtypes";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type ResourceWithId = Omit<Resource, "id"> & { id: string };

export type ComputeResourceDiffRequest = {
  ehr: EhrSource;
  cxId: string;
  patientId: string;
  existingResources: ResourceWithId[];
  newResource: ResourceWithId;
  direction: ResourceDiffDirection;
};

export interface EhrComputeResourceDiffHandler {
  computeResourceDiff(request: ComputeResourceDiffRequest): Promise<void>;
}
