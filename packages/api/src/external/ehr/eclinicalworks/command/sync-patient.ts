import EclinicalworksApi from "@metriport/core/external/ehr/eclinicalworks/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import {
  createMetriportPatientDemosFhir,
  getOrCreateMetriportPatientFhir,
} from "../../shared-fhir";
import { createEclinicalworksClient } from "../shared";

export type SyncEclinicalworksPatientIntoMetriportParams = {
  cxId: string;
  eclinicalworksPracticeId: string;
  eclinicalworksPatientId: string;
  eclinicalworksAuthToken: string;
  eclinicalworksAud: string;
  api?: EclinicalworksApi;
  triggerDq?: boolean;
};

export async function syncEclinicalworksPatientIntoMetriport({
  cxId,
  eclinicalworksPracticeId,
  eclinicalworksPatientId,
  eclinicalworksAuthToken,
  eclinicalworksAud,
  api,
  triggerDq = false,
}: SyncEclinicalworksPatientIntoMetriportParams): Promise<string> {
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
    (await createEclinicalworksClient({
      cxId,
      practiceId: eclinicalworksPracticeId,
      authToken: eclinicalworksAuthToken,
      aud: eclinicalworksAud,
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
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatient.id,
    }).catch(processAsyncError(`Eclinicalworks queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: eclinicalworksPatientId,
    source: EhrSources.eclinicalworks,
  });
  return metriportPatient.id;
}
