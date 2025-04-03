import CanvasApi from "@metriport/core/external/ehr/canvas/index";
import { buildEhrResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/ehr-resource-diff-factory";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { ResourceTypeForConsolidation } from "@metriport/shared/medical";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import {
  getConsolidatedPatientData,
  GetConsolidatedPatientData,
} from "../../../../command/medical/patient/consolidated-get";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { createCanvasClient } from "../shared";
import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceWithId } from "@metriport/core/external/ehr/resource-diff/ehr-resource-diff";

export type SyncCanvasPatientIntoMetriportParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  resourceType: ResourceTypeForConsolidation;
  direction: ResourceDiffDirection;
  resource: FhirResource;
  api?: CanvasApi;
};

export async function computeCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  resourceType,
  direction,
  resource,
  api,
}: SyncCanvasPatientIntoMetriportParams): Promise<void> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
  let existingResources: FhirResource[] = [];
  if (direction === ResourceDiffDirection.DIFF_EHR) {
    existingResources = await canvasApi.getFhirResourcesByResourceType({
      cxId,
      patientId: canvasPatientId,
      resourceType,
    });
  } else {
    const payload: GetConsolidatedPatientData = {
      patient: metriportPatient,
      resources: [resourceType],
    };
    const bundle = await getConsolidatedPatientData(payload);
    existingResources = bundle.entry?.map(entry => entry.resource as FhirResource) ?? [];
  }
  if (existingResources.length === 0) return;
  const ehrResourceDiffHandler = buildEhrResourceDiffHandler();
  await ehrResourceDiffHandler.processResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    patientId: canvasPatientId,
    existingResources: existingResources as ResourceWithId[],
    newResource: resource as ResourceWithId,
    direction,
  });
}
