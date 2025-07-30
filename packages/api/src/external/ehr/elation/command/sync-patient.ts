import { PatientDemoData } from "@metriport/core/domain/patient";
import ElationApi from "@metriport/core/external/ehr/elation/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { errorToString, MetriportError, normalizeDob, normalizeGender } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { elationDashSource } from "@metriport/shared/interface/external/ehr/elation/jwt-token";
import { Patient as ElationPatient } from "@metriport/shared/interface/external/ehr/elation/patient";
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
import { createAddresses, createContacts, createElationClient, createNames } from "../shared";
import { getPatientPrimaryFacilityIdOrFail } from "../../../../command/medical/patient/get-patient-facilities";

dayjs.extend(duration);

export const longDurationTokenDuration = dayjs.duration(1, "year");
export const shortDurationTokenDuration = dayjs.duration(10, "hours");

const unknownPatientId = "unknown";

export type SyncElationPatientIntoMetriportParams = {
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
  api?: ElationApi;
  triggerDq?: boolean;
  triggerDqForExistingPatient?: boolean;
};

export async function syncElationPatientIntoMetriport({
  cxId,
  elationPracticeId,
  elationPatientId,
  api,
  triggerDq = false,
  triggerDqForExistingPatient = false,
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
    const facilityId = await getPatientPrimaryFacilityIdOrFail({
      cxId,
      patientId: metriportPatient.id,
    });
    if (triggerDqForExistingPatient && isDqCooldownExpired(metriportPatient)) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatient.id,
        facilityId,
      }).catch(processAsyncError(`Elation queryDocumentsAcrossHIEs`));
    }
    const metriportPatientId = metriportPatient.id;
    await createElationPatientMetadata({
      cxId,
      elationPracticeId,
      elationPatientId,
      metriportPatientId,
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
  const facilityId = await getPatientPrimaryFacilityIdOrFail({
    cxId,
    patientId: metriportPatient.id,
  });
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatientId,
      facilityId,
    }).catch(processAsyncError(`Elation queryDocumentsAcrossHIEs`));
  }
  await Promise.all([
    findOrCreatePatientMapping({
      cxId,
      patientId: metriportPatientId,
      externalId: elationPatientId,
      source: EhrSources.elation,
    }),
    createElationPatientMetadata({
      cxId,
      elationPracticeId,
      elationPatientId,
      metriportPatientId,
      elationApi,
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
  const source = elationDashSource;
  const data = {
    practiceId: elationPracticeId,
    patientId: elationPatientId,
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

type CreateElationPatientMetadataParams = {
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
  metriportPatientId?: string;
  elationApi?: ElationApi;
};

async function createElationPatientMetadata({
  cxId,
  elationPracticeId,
  elationPatientId,
  metriportPatientId,
  elationApi,
}: CreateElationPatientMetadataParams): Promise<void> {
  const ehrDashUrl = await createElationPatientLink({ elationPracticeId, elationPatientId });
  const api = elationApi ?? (await createElationClient({ cxId, practiceId: elationPracticeId }));
  await api.updatePatientMetadata({
    cxId,
    patientId: elationPatientId,
    metadata: {
      object_id: metriportPatientId ?? unknownPatientId,
      object_web_link: ehrDashUrl,
    },
  });
}

export type CreateOrUpdateElationPatientMetadataParams = Omit<
  CreateElationPatientMetadataParams,
  "metriportPatientId" | "elationApi"
>;

export async function createOrUpdateElationPatientMetadata({
  cxId,
  elationPracticeId,
  elationPatientId,
}: CreateOrUpdateElationPatientMetadataParams): Promise<void> {
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: elationPatientId,
    source: EhrSources.elation,
  });
  if (existingPatient) {
    await createElationPatientMetadata({
      cxId,
      elationPracticeId,
      elationPatientId,
      metriportPatientId: existingPatient.patientId,
    });
    return;
  }
  await createElationPatientMetadata({
    cxId,
    elationPracticeId,
    elationPatientId,
  });
}
