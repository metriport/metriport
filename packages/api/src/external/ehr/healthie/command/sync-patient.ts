import { PatientDemoData } from "@metriport/core/domain/patient";
import HealthieApi from "@metriport/core/external/ehr/healthie";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { healthieDashSource } from "@metriport/shared/interface/external/ehr/healthie/jwt-token";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { MetriportError } from "../../../../../../shared/dist";
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
import { handleMetriportSync, HandleMetriportSyncParams } from "../../patient";
import { createHealthieClient } from "../shared";

dayjs.extend(duration);

export const longDurationTokenDuration = dayjs.duration(1, "year");
export const shortDurationTokenDuration = dayjs.duration(10, "hours");

export type SyncHealthiePatientIntoMetriportParams = {
  cxId: string;
  healthiePracticeId: string;
  healthiePatientId: string;
  api?: HealthieApi;
  triggerDq?: boolean;
};

export async function syncHealthiePatientIntoMetriport({
  cxId,
  healthiePracticeId,
  healthiePatientId,
  api,
  triggerDq = false,
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
  const demographics = createMetriportPatientDemographics(
    healthiePatient as unknown as PatientDemoData
  );
  const metriportPatient = await getOrCreateMetriportPatient({
    cxId,
    practiceId: healthiePracticeId,
    demographics,
    externalId: healthiePatientId,
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

function createMetriportPatientDemographics(patient: PatientDemoData): PatientDemoData {
  // TODO: Implement
  return patient;
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
