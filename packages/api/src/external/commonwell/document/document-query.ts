import { isCommonwellV2EnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { Patient } from "@metriport/core/domain/patient";
import { queryAndProcessDocuments as queryAndProcessDocumentsV1 } from "../../commonwell-v1/document/document-query";
import { queryAndProcessDocuments as queryAndProcessDocumentsV2 } from "../../commonwell-v2/document/document-query";

export async function queryAndProcessDocuments({
  patient: patientParam,
  facilityId,
  forceQuery = false,
  forcePatientDiscovery = false,
  forceDownload,
  ignoreDocRefOnFHIRServer,
  ignoreFhirConversionAndUpsert,
  requestId,
  getOrgIdExcludeList,
  triggerConsolidated = false,
}: {
  patient: Patient;
  facilityId?: string | undefined;
  forceQuery?: boolean;
  forcePatientDiscovery?: boolean;
  forceDownload?: boolean;
  ignoreDocRefOnFHIRServer?: boolean;
  ignoreFhirConversionAndUpsert?: boolean;
  requestId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  triggerConsolidated?: boolean;
}): Promise<void> {
  const isCwV2Enabled = await isCommonwellV2EnabledForCx(patientParam.cxId);

  // TODO ENG-554 Remove FF and v1 code
  if (!isCwV2Enabled) {
    await queryAndProcessDocumentsV1({
      patient: patientParam,
      facilityId,
      forceQuery,
      forcePatientDiscovery,
      forceDownload,
      ignoreDocRefOnFHIRServer,
      ignoreFhirConversionAndUpsert,
      requestId,
      getOrgIdExcludeList,
      triggerConsolidated,
    });
    return;
  }

  await queryAndProcessDocumentsV2({
    patient: patientParam,
    facilityId,
    forceQuery,
    forcePatientDiscovery,
    forceDownload,
    ignoreDocRefOnFHIRServer,
    ignoreFhirConversionAndUpsert,
    requestId,
    getOrgIdExcludeList,
    triggerConsolidated,
  });
}
