import { PatientDemoData } from "@metriport/core/domain/patient";
import HealthieApi from "@metriport/core/external/ehr/healthie";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  BadRequestError,
  errorToString,
  MetriportError,
  normalizeDob,
  normalizeGender,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { healthieDashSource } from "@metriport/shared/interface/external/ehr/healthie/jwt-token";
import { Patient as HealthiePatient } from "@metriport/shared/interface/external/ehr/healthie/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  deleteTokenBasedOnExpBySourceAndData,
  findOrCreateJwtToken,
} from "../../../../command/jwt-token";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import {
  getPatientByDemo,
  getPatientOrFail,
  PatientWithIdentifiers,
} from "../../../../command/medical/patient/get-patient";
import { Config } from "../../../../shared/config";
import {
  handleMetriportSync,
  HandleMetriportSyncParams,
  isDqCooldownExpired,
} from "../../shared/utils/patient";
import { createAddresses, createContacts, createHealthieClient, createNames } from "../shared";

dayjs.extend(duration);

export const longDurationTokenDuration = dayjs.duration(1, "year");
export const shortDurationTokenDuration = dayjs.duration(10, "hours");

export type SyncHealthiePatientIntoMetriportParams = {
  cxId: string;
  healthiePracticeId: string;
  healthiePatientId: string;
  api?: HealthieApi;
  triggerDq?: boolean;
  triggerDqForExistingPatient?: boolean;
  inputMetriportPatientId?: string;
};

export async function syncHealthiePatientIntoMetriport({
  cxId,
  healthiePracticeId,
  healthiePatientId,
  api,
  triggerDq = false,
  triggerDqForExistingPatient = false,
  inputMetriportPatientId,
}: SyncHealthiePatientIntoMetriportParams): Promise<string> {
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: healthiePatientId,
    source: EhrSources.healthie,
  });
  if (existingPatient) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    if (triggerDqForExistingPatient && isDqCooldownExpired(metriportPatient)) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatient.id,
      }).catch(processAsyncError(`Healthie queryDocumentsAcrossHIEs`));
    }
    const metriportPatientId = metriportPatient.id;
    await updateHealthiePatientQuickNotes({
      cxId,
      healthiePracticeId,
      healthiePatientId,
    });
    return metriportPatientId;
  }

  const healthieApi = api ?? (await createHealthieClient({ cxId, practiceId: healthiePracticeId }));
  const healthiePatient = await healthieApi.getPatient({ cxId, patientId: healthiePatientId });
  const demographics = createMetriportPatientDemographics(healthiePatient);
  const metriportPatient = await getOrCreateMetriportPatient({
    cxId,
    practiceId: healthiePracticeId,
    demographics,
    externalId: healthiePatientId,
    inputMetriportPatientId,
  });
  const metriportPatientId = metriportPatient.id;
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatientId,
    }).catch(processAsyncError(`Healthie queryDocumentsAcrossHIEs`));
  }
  await Promise.all([
    findOrCreatePatientMapping({
      cxId,
      patientId: metriportPatientId,
      externalId: healthiePatientId,
      source: EhrSources.healthie,
    }),
    updateHealthiePatientQuickNotes({
      cxId,
      healthiePracticeId,
      healthiePatientId,
      healthieApi,
    }),
  ]);
  return metriportPatientId;
}

function createMetriportPatientDemographics(patient: HealthiePatient): PatientDemoData {
  if (!patient.dob) throw new BadRequestError("Patient has no dob");
  if (!patient.gender) throw new BadRequestError("Patient has no gender");
  const dob = normalizeDob(patient.dob);
  const genderAtBirth = normalizeGender(patient.gender);
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
  inputMetriportPatientId,
}: Omit<HandleMetriportSyncParams, "source"> & {
  inputMetriportPatientId?: string;
}): Promise<PatientWithIdentifiers> {
  if (inputMetriportPatientId) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: inputMetriportPatientId,
    });
    return metriportPatient;
  }
  const metriportPatient = await getPatientByDemo({ cxId, demo: demographics });
  if (metriportPatient) return metriportPatient;
  return await handleMetriportSync({
    cxId,
    source: EhrSources.healthie,
    practiceId,
    demographics,
    externalId,
  });
}

async function createHealthiePatientLink({
  healthiePracticeId,
  healthiePatientId,
}: {
  healthiePracticeId: string;
  healthiePatientId: string;
}): Promise<string> {
  const ehrDashUrl = Config.getEhrDashUrl();
  const source = healthieDashSource;
  const data = {
    practiceId: healthiePracticeId,
    patientId: healthiePatientId,
    source,
  };
  try {
    await deleteTokenBasedOnExpBySourceAndData({
      source,
      data,
      exp: buildDayjs().add(shortDurationTokenDuration).toDate(),
      expComparison: "gte",
    });
    const jwtToken = await findOrCreateJwtToken({
      token: uuidv7(),
      exp: buildDayjs().add(longDurationTokenDuration).toDate(),
      source,
      data,
    });
    return `${ehrDashUrl}/healthie/app#patient=${healthiePatientId}&access_token=${jwtToken.token}`;
  } catch (error) {
    const msg = "Healthie patient link creation failed";
    out(
      `createHealthiePatientLink - healthiePracticeId ${healthiePracticeId} healthiePatientId ${healthiePatientId}`
    ).log(`${msg} - ${errorToString(error)}`);
    throw new MetriportError(msg, undefined, {
      healthiePracticeId,
      healthiePatientId,
    });
  }
}

export type UpdateHealthiePatientQuickNotesParams = {
  cxId: string;
  healthiePracticeId: string;
  healthiePatientId: string;
  healthieApi?: HealthieApi;
};

export async function updateHealthiePatientQuickNotes({
  cxId,
  healthiePracticeId,
  healthiePatientId,
  healthieApi,
}: UpdateHealthiePatientQuickNotesParams): Promise<void> {
  const ehrDashUrl = await createHealthiePatientLink({ healthiePracticeId, healthiePatientId });
  const api = healthieApi ?? (await createHealthieClient({ cxId, practiceId: healthiePracticeId }));
  await api.updatePatientQuickNotesWithLink({
    cxId,
    patientId: healthiePatientId,
    link: ehrDashUrl,
  });
}
