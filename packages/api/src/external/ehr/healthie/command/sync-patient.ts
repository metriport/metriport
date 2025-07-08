import { PatientDemoData } from "@metriport/core/domain/patient";
import HealthieApi from "@metriport/core/external/ehr/healthie";
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
import {
  getPatientByDemo,
  PatientWithIdentifiers,
} from "../../../../command/medical/patient/get-patient";
import { Config } from "../../../../shared/config";
import { SyncPatientParamsWithPracticeId } from "../../shared/command/sync/sync-patient";
import { handleMetriportSync, HandleMetriportSyncParams } from "../../shared/utils/patient";
import { createAddresses, createContacts, createHealthieClient, createNames } from "../shared";

dayjs.extend(duration);

export const longDurationTokenDuration = dayjs.duration(1, "year");
export const shortDurationTokenDuration = dayjs.duration(10, "hours");

export async function syncHealthiePatientIntoMetriport({
  cxId,
  practiceId,
  ehrPatientId,
}: SyncPatientParamsWithPracticeId): Promise<string> {
  const healthieApi = await createHealthieClient({ cxId, practiceId });
  const healthiePatient = await healthieApi.getPatient({ cxId, patientId: ehrPatientId });
  const demographics = createMetriportPatientDemographics(healthiePatient);
  const metriportPatient = await getOrCreateMetriportPatient({
    cxId,
    practiceId,
    demographics,
    externalId: ehrPatientId,
  });
  const metriportPatientId = metriportPatient.id;
  await updateHealthiePatientQuickNotes({
    cxId,
    healthiePracticeId: practiceId,
    healthiePatientId: ehrPatientId,
    healthieApi,
  });
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
}: Omit<HandleMetriportSyncParams, "source">): Promise<PatientWithIdentifiers> {
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
