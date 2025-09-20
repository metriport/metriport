import { Patient } from "@metriport/core/domain/patient";
import { queryAndProcessDocuments as queryAndProcessDocumentsV2 } from "../../commonwell-v2/document/document-query";

export async function queryAndProcessDocuments({
  patient: patientParam,
  facilityId,
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
  forcePatientDiscovery?: boolean;
  forceDownload?: boolean;
  ignoreDocRefOnFHIRServer?: boolean;
  ignoreFhirConversionAndUpsert?: boolean;
  requestId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  triggerConsolidated?: boolean;
}): Promise<void> {
  await queryAndProcessDocumentsV2({
    patient: patientParam,
    facilityId,
    forcePatientDiscovery,
    forceDownload,
    ignoreDocRefOnFHIRServer,
    ignoreFhirConversionAndUpsert,
    requestId,
    getOrgIdExcludeList,
    triggerConsolidated,
  });
}
