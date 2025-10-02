import EClinicalWorksApi from "@metriport/core/external/ehr/eclinicalworks/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { MetriportError } from "@metriport/shared";
import { eclinicalworksDashSource } from "@metriport/shared/interface/external/ehr/eclinicalworks/jwt-token";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getJwtTokenByIdOrFail } from "../../../../command/jwt-token";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { getPatientPrimaryFacilityIdOrFail } from "../../../../command/medical/patient/get-patient-facilities";
import { getOrCreateMetriportPatientFhir } from "../../shared/command/patient/get-or-create-metriport-patient-fhir";
import { createMetriportPatientDemosFhir } from "../../shared/utils/fhir";
import { createEClinicalWorksClient } from "../shared";

export type SyncEClinicalWorksPatientIntoMetriportParams = {
  cxId: string;
  eclinicalworksPracticeId: string;
  eclinicalworksPatientId: string;
  eclinicalworksTokenId: string;
  api?: EClinicalWorksApi;
  triggerDq?: boolean;
};

export async function syncEClinicalWorksPatientIntoMetriport({
  cxId,
  eclinicalworksPracticeId,
  eclinicalworksPatientId,
  eclinicalworksTokenId,
  api,
  triggerDq = false,
}: SyncEClinicalWorksPatientIntoMetriportParams): Promise<string> {
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: eclinicalworksPatientId,
    source: EhrSources.eclinicalworks,
  });
  if (existingPatient) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }

  const eclinicalworksApi =
    api ??
    (await createEClinicalWorksClientFromTokenId({
      cxId,
      practiceId: eclinicalworksPracticeId,
      tokenId: eclinicalworksTokenId,
    }));
  const eclinicalworksPatient = await eclinicalworksApi.getPatient({
    cxId,
    patientId: eclinicalworksPatientId,
  });
  const possibleDemographics = createMetriportPatientDemosFhir(eclinicalworksPatient);
  const metriportPatient = await getOrCreateMetriportPatientFhir({
    cxId,
    source: EhrSources.eclinicalworks,
    practiceId: eclinicalworksPracticeId,
    possibleDemographics,
    externalId: eclinicalworksPatientId,
  });
  const facilityId = await getPatientPrimaryFacilityIdOrFail({
    cxId,
    patientId: metriportPatient.id,
  });
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatient.id,
      facilityId,
    }).catch(processAsyncError(`EClinicalWorks queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: eclinicalworksPatientId,
    source: EhrSources.eclinicalworks,
    secondaryMappings: { practiceId: eclinicalworksPracticeId },
  });
  return metriportPatient.id;
}

async function createEClinicalWorksClientFromTokenId({
  cxId,
  practiceId,
  tokenId,
}: {
  cxId: string;
  practiceId: string;
  tokenId: string;
}): Promise<EClinicalWorksApi> {
  const token = await getJwtTokenByIdOrFail(tokenId);
  if (token.data.source !== eclinicalworksDashSource) {
    throw new MetriportError("Invalid token source", undefined, {
      tokenId,
      source: token.data.source,
    });
  }
  const tokenPracticeId = token.data.practiceId;
  if (tokenPracticeId !== practiceId) {
    throw new MetriportError("Invalid token practiceId", undefined, {
      tokenId,
      source: token.data.source,
      tokenPracticeId,
      practiceId,
    });
  }
  const api = await createEClinicalWorksClient({
    cxId,
    practiceId,
    authToken: token.token,
  });
  return api;
}
