import { PatientDemoData } from "@metriport/core/domain/patient";
import ElationApi from "@metriport/core/external/ehr/elation/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { errorToString, MetriportError, normalizeDob, normalizeGender } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { Patient as ElationPatient } from "@metriport/shared/interface/external/ehr/elation/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import { findOrCreateJwtToken } from "../../../../command/jwt-token";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import {
  getPatientByDemo,
  getPatientOrFail,
  PatientWithIdentifiers,
} from "../../../../command/medical/patient/get-patient";
import { Config } from "../../../../shared/config";
import { handleMetriportSync, HandleMetriportSyncParams } from "../../patient";
import { createAddresses, createContacts, createElationClient, createNames } from "../shared";

export const longDurationTokenDuration = dayjs.duration(1, "year");

export type SyncElationPatientIntoMetriportParams = {
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
  api?: ElationApi;
  triggerDq?: boolean;
};

export async function syncElationPatientIntoMetriport({
  cxId,
  elationPracticeId,
  elationPatientId,
  api,
  triggerDq = false,
}: SyncElationPatientIntoMetriportParams): Promise<string> {
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: elationPatientId,
    source: EhrSources.elation,
  });
  if (existingPatient) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    const metriportPatientId = metriportPatient.id;
    const ehrDashUrl = await createElationPatientLink({ elationPracticeId, elationPatientId });
    const elationApi = api ?? (await createElationClient({ cxId, practiceId: elationPracticeId }));
    await elationApi.updatePatientMetadata({
      cxId,
      patientId: elationPatientId,
      metadata: {
        object_id: metriportPatientId,
        object_web_link: ehrDashUrl,
      },
    });
    return metriportPatientId;
  }

  const elationApi = api ?? (await createElationClient({ cxId, practiceId: elationPracticeId }));
  const elationPatient = await elationApi.getPatient({ cxId, patientId: elationPatientId });
  const demographics = createMetriportPatientDemographics(elationPatient);
  const metriportPatient = await getOrCreateMetriportPatient({
    cxId,
    practiceId: elationPracticeId,
    demographics,
    externalId: elationPatientId,
  });
  const metriportPatientId = metriportPatient.id;
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatientId,
    }).catch(processAsyncError(`Elation queryDocumentsAcrossHIEs`));
  }
  const ehrDashUrl = await createElationPatientLink({ elationPracticeId, elationPatientId });
  await Promise.all([
    findOrCreatePatientMapping({
      cxId,
      patientId: metriportPatientId,
      externalId: elationPatientId,
      source: EhrSources.elation,
    }),
    elationApi.updatePatientMetadata({
      cxId,
      patientId: elationPatientId,
      metadata: {
        object_id: metriportPatientId,
        object_web_link: ehrDashUrl,
      },
    }),
  ]);
  return metriportPatientId;
}

function createMetriportPatientDemographics(patient: ElationPatient): PatientDemoData {
  const dob = normalizeDob(patient.dob);
  const genderAtBirth = normalizeGender(patient.sex);
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

async function getOrCreateMetriportPatient({
  cxId,
  practiceId,
  demographics,
  externalId,
}: Omit<HandleMetriportSyncParams, "source">): Promise<PatientWithIdentifiers> {
  const metriportPatient = await getPatientByDemo({ cxId, demo: demographics });
  if (metriportPatient) return metriportPatient;
  return await handleMetriportSync({
    cxId,
    source: EhrSources.elation,
    practiceId,
    demographics,
    externalId,
  });
}

async function createElationPatientLink({
  elationPracticeId,
  elationPatientId,
}: {
  elationPracticeId: string;
  elationPatientId: string;
}): Promise<string> {
  const ehrDashUrl = Config.getEhrDashUrl();
  const source = EhrSources.elation;
  try {
    const jwtToken = await findOrCreateJwtToken({
      token: uuidv7(),
      data: {
        practiceId: elationPracticeId,
        patientId: elationPatientId,
        source,
      },
      source,
      exp: buildDayjs().add(longDurationTokenDuration).toDate(),
    });
    return `${ehrDashUrl}/elation/app#patient=${elationPatientId}&access_token=${jwtToken.token}`;
  } catch (error) {
    const msg = "Elation patient link creation failed";
    out(
      `createElationPatientLink - elationPracticeId ${elationPracticeId} elationPatientId ${elationPatientId}`
    ).log(`${msg} - ${errorToString(error)}`);
    throw new MetriportError(msg, undefined, {
      elationPracticeId,
      elationPatientId,
    });
  }
}
