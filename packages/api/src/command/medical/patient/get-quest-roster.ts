import {
  getCxsWithQuestFeatureFlag,
  isQuestFeatureFlagEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { Patient } from "@metriport/core/domain/patient";
import { buildQuestExternalId } from "@metriport/core/external/quest/id-generator";
import { capture, executeAsynchronously } from "@metriport/core/util";
import { LogFunction, out } from "@metriport/core/util/log";
import { BadRequestError } from "@metriport/shared";
import { QuestRosterType } from "@metriport/shared/interface/external/quest/roster";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import { FindOptions, Op, OrderItem, Sequelize, UniqueConstraintError } from "sequelize";
import {
  createPatientMapping,
  findFirstPatientMappingForSource,
} from "../../../command/mapping/patient";
import { PatientModelReadOnly } from "../../../models/medical/patient-readonly";
import { getRosterOrFail } from "../../medical/roster/get-roster";
import { getPatientIdsOnRoster } from "../../medical/roster/patient-roster/get-roster-patient-ids";
import {
  Pagination,
  getPaginationFilters,
  getPaginationLimits,
  getPaginationSorting,
} from "../../pagination";

const MAX_ATTEMPTS_TO_CREATE_EXTERNAL_ID = 2;
const EXTERNAL_ID_LOOKUP_CONCURRENCY = 10;

export type GetQuestNotificationsRosterParams = {
  pagination?: Pagination;
};

export type GetQuestBackfillRosterParams = {
  cxId: string;
  rosterId: string;
  pagination?: Pagination;
};

export async function getQuestNotificationRoster({
  pagination,
}: GetQuestNotificationsRosterParams): Promise<Patient[]> {
  const { log } = out(`getQuestNotificationRoster`);
  log(`Pagination params: ${JSON.stringify(pagination)}`);
  const cxIds = await getCxsWithQuestFeatureFlag();

  const findOptions: FindOptions<PatientModelReadOnly> = {
    where: {
      ...(pagination ? getPaginationFilters(pagination) : {}),
      cxId: { [Op.in]: cxIds },
      [Op.and]: [
        Sequelize.literal(`
            EXISTS (
              SELECT 1
              FROM patient_cohort pc
              JOIN cohort ch ON ch.id = pc.cohort_id
              WHERE pc.patient_id = "PatientModelReadOnly"."id"
                AND COALESCE((ch.settings->'monitoring'->'laboratory'->>'notifications')::boolean, false) = true
            )
          `),
      ],
    },
    ...(pagination ? getPaginationLimits(pagination) : {}),
    ...(pagination ? { order: [getPaginationSorting(pagination) as OrderItem] } : {}),
  };
  const patients = await PatientModelReadOnly.findAll(findOptions);
  const patientsWithQuestId = await applyQuestExternalIdToPatients(patients, log);
  log(`Generated Quest notifications roster with ${patientsWithQuestId.length} patients`);
  return patientsWithQuestId;
}

export async function getQuestBackfillRoster({
  cxId,
  rosterId,
  pagination,
}: GetQuestBackfillRosterParams): Promise<Patient[]> {
  const { log } = out(`getQuestBackfillRoster - cxId ${cxId}, rosterId ${rosterId}`);
  log(`Pagination params: ${JSON.stringify(pagination)}`);
  const isQuestEnabled = await isQuestFeatureFlagEnabledForCx(cxId);
  if (!isQuestEnabled) {
    throw new BadRequestError("Quest is not enabled for cx", undefined, {
      cxId,
    });
  }

  const roster = await getRosterOrFail({ rosterId, cxId });
  if (roster.source !== questSource) {
    throw new BadRequestError("Roster is not a Quest roster", undefined, {
      rosterId,
      cxId,
      expectedSource: questSource,
      actualSource: roster.source,
    });
  }
  if (roster.type !== QuestRosterType.BACKFILL) {
    throw new BadRequestError("Roster type does not match the requested roster type", undefined, {
      rosterId,
      cxId,
      expectedRosterType: QuestRosterType.BACKFILL,
      actualRosterType: roster.type,
    });
  }
  if (roster.status !== "closed") {
    throw new BadRequestError("Roster is not closed", undefined, {
      rosterId,
      cxId,
      expectedStatus: "closed",
      actualStatus: roster.status,
    });
  }
  const patientIds = await getPatientIdsOnRoster({
    rosterId,
    cxId,
    pagination,
  });
  if (patientIds.length < 1) return [];
  const patients = await PatientModelReadOnly.findAll({
    where: {
      id: { [Op.in]: patientIds },
      cxId,
    },
    ...(pagination ? { order: [getPaginationSorting(pagination) as OrderItem] } : {}),
  });
  const patientsWithQuestId = await applyQuestExternalIdToPatients(patients, log);
  log(`Generated Quest backfill roster with ${patientsWithQuestId.length} patients`);
  return patientsWithQuestId;
}

async function applyQuestExternalIdToPatients(
  patients: PatientModelReadOnly[],
  log: LogFunction
): Promise<Patient[]> {
  const patientQuestIdMapping: Record<string, string> = {};
  const patientsWithError: Patient[] = [];
  await executeAsynchronously(
    patients,
    async patientResult => {
      const patient = patientResult.dataValues;
      try {
        const externalId = await findOrCreateQuestExternalId(patient, log);
        patientQuestIdMapping[patient.id] = externalId;
      } catch (error) {
        patientsWithError.push(patient);
      }
    },
    {
      numberOfParallelExecutions: EXTERNAL_ID_LOOKUP_CONCURRENCY,
    }
  );
  if (patientsWithError.length > 0) {
    const msg = "Failed to get some Quest external IDs";
    log(`${msg} - ${patientsWithError.length} patients failed`);
    capture.error(msg, {
      extra: {
        patientIdsWithError: patientsWithError.map(patient => patient.id).join(", "),
      },
      level: "warning",
    });
  }
  const patientsWithQuestId: Patient[] = patients.flatMap(patient => {
    const externalId = patientQuestIdMapping[patient.id];
    if (!externalId) return [];
    return [{ ...patient.dataValues, externalId }];
  });
  return patientsWithQuestId;
}

async function findOrCreateQuestExternalId(
  patient: Patient,
  log: LogFunction,
  attempt = 1
): Promise<string> {
  const mapping = await findFirstPatientMappingForSource({
    patientId: patient.id,
    source: questSource,
  });
  if (mapping) {
    log(`Found Quest mapping: ${patient.id} <-> ${mapping.externalId}`);
    return mapping.externalId;
  }

  const externalId = buildQuestExternalId();
  try {
    const created = await createPatientMapping({
      cxId: patient.cxId,
      patientId: patient.id,
      externalId,
      source: questSource,
      secondaryMappings: {},
    });
    log(`Created Quest mapping: ${patient.id} <-> ${created.externalId}`);
    return created.externalId;
  } catch (error) {
    // Handles the very improbable case where there is an ID collision
    if (error instanceof UniqueConstraintError && attempt < MAX_ATTEMPTS_TO_CREATE_EXTERNAL_ID) {
      return findOrCreateQuestExternalId(patient, log, attempt + 1);
    }
    throw error;
  }
}
