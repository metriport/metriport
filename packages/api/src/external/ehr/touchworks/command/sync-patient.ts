import TouchWorksApi from "@metriport/core/external/ehr/touchworks/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { MetriportError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { touchworksDashSource } from "@metriport/shared/interface/external/ehr/touchworks/jwt-token";
import { getJwtTokenByIdOrFail } from "../../../../command/jwt-token";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import {
  createMetriportPatientDemosFhir,
  getOrCreateMetriportPatientFhir,
} from "../../shared/utils/fhir";
import { createTouchWorksClient } from "../shared";

export type SyncTouchWorksPatientIntoMetriportParams = {
  cxId: string;
  touchworksPracticeId: string;
  touchworksPatientId: string;
  touchworksTokenId: string;
  api?: TouchWorksApi;
  triggerDq?: boolean;
};

export async function syncTouchWorksPatientIntoMetriport({
  cxId,
  touchworksPracticeId,
  touchworksPatientId,
  touchworksTokenId,
  api,
  triggerDq = false,
}: SyncTouchWorksPatientIntoMetriportParams): Promise<string> {
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: touchworksPatientId,
    source: EhrSources.touchworks,
  });
  if (existingPatient) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }

  const touchworksApi =
    api ??
    (await createTouchWorksClientFromTokenId({
      cxId,
      practiceId: touchworksPracticeId,
      tokenId: touchworksTokenId,
    }));
  const touchworksPatient = await touchworksApi.getPatient({
    cxId,
    patientId: touchworksPatientId,
  });
  const possibleDemographics = createMetriportPatientDemosFhir(touchworksPatient);
  const metriportPatient = await getOrCreateMetriportPatientFhir({
    cxId,
    source: EhrSources.touchworks,
    practiceId: touchworksPracticeId,
    possibleDemographics,
    externalId: touchworksPatientId,
  });
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatient.id,
    }).catch(processAsyncError(`TouchWorks queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: touchworksPatientId,
    source: EhrSources.touchworks,
  });
  return metriportPatient.id;
}

async function createTouchWorksClientFromTokenId({
  cxId,
  practiceId,
  tokenId,
}: {
  cxId: string;
  practiceId: string;
  tokenId: string;
}): Promise<TouchWorksApi> {
  const token = await getJwtTokenByIdOrFail(tokenId);
  if (token.data.source !== touchworksDashSource) {
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
  const api = await createTouchWorksClient({
    cxId,
    practiceId,
    authToken: token.token,
  });
  return api;
}
