import { PatientDemoData } from "@metriport/core/domain/patient";
import EpicApi from "@metriport/core/external/ehr/epic/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { BadRequestError, MetriportError, normalizeDob, normalizeGender } from "@metriport/shared";
import { epicDashSource } from "@metriport/shared/interface/external/ehr/epic/jwt-token";
import { Patient as EpicPatient } from "@metriport/shared/interface/external/ehr/epic/patient";
import { getJwtTokenByIdOrFail } from "../../../../command/jwt-token";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { getPatientPrimaryFacilityIdOrFail } from "../../../../command/medical/patient/get-patient-facilities";
import { getOrCreateMetriportPatient } from "../../shared/command/patient/get-or-create-metriport-patient";
import { createAddresses, createContacts, createNames, createEpicClient } from "../shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";

export type SyncEpicPatientIntoMetriportParams = {
  cxId: string;
  epicPracticeId: string;
  epicPatientId: string;
  epicInstanceUrl: string;
  epicTokenId: string;
  api?: EpicApi;
  triggerDq?: boolean;
};

export async function syncEpicPatientIntoMetriport({
  cxId,
  epicPracticeId,
  epicPatientId,
  epicInstanceUrl,
  epicTokenId,
  api,
  triggerDq = false,
}: SyncEpicPatientIntoMetriportParams): Promise<string> {
  const { log } = out(
    `syncEpicPatientIntoMetriport - practiceId: ${epicPracticeId} ptId: ${epicPatientId}`
  );

  const existingPatient = await getPatientMapping({
    cxId,
    externalId: epicPatientId,
    source: EhrSources.epic,
  });

  if (existingPatient) {
    log("existing patient mapping found", existingPatient.patientId);
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }

  log("no existing mapping found, creating new patient");

  const epicApi =
    api ??
    (await createEpicClientFromTokenId({
      cxId,
      practiceId: epicPracticeId,
      instanceUrl: epicInstanceUrl,
      tokenId: epicTokenId,
    }));
  const epicPatient = await epicApi.getPatientFromContact({
    cxId,
    patientId: epicPatientId,
  });
  const demographics = createMetriportPatientDemographics(epicPatient);

  const metriportPatient = await getOrCreateMetriportPatient({
    cxId,
    source: EhrSources.epic,
    practiceId: epicPracticeId,
    demographics,
    externalId: epicPatientId,
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
    }).catch(processAsyncError(`Epic queryDocumentsAcrossHIEs`));
  }

  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: epicPatientId,
    source: EhrSources.epic,
    secondaryMappings: { practiceId: epicPracticeId },
  });

  return metriportPatient.id;
}

function createMetriportPatientDemographics(patient: EpicPatient): PatientDemoData {
  if (!patient.Birthdate) throw new BadRequestError("Patient has no dob");
  if (!patient.GenderIdentity) throw new BadRequestError("Patient has no gender");
  const dob = normalizeDob(patient.Birthdate);
  const genderAtBirth = normalizeGender(patient.GenderIdentity);
  const addressArray = createAddresses(patient);
  const contactArray = createContacts(patient);
  const names = createNames(patient);
  return {
    ...names,
    dob,
    genderAtBirth,
    address: addressArray,
    contact: contactArray,
  };
}

async function createEpicClientFromTokenId({
  cxId,
  practiceId,
  instanceUrl,
  tokenId,
}: {
  cxId: string;
  practiceId: string;
  instanceUrl: string;
  tokenId: string;
}): Promise<EpicApi> {
  const token = await getJwtTokenByIdOrFail(tokenId);
  if (token.data.source !== epicDashSource) {
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
  return await createEpicClient({
    cxId,
    practiceId,
    authToken: token.token,
    instanceUrl,
  });
}
