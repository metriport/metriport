import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError } from "@metriport/shared";
import {
  ElationSecondaryMappings,
  elationSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import {
  Appointment,
  delayBetweenPatientBatches,
  delayBetweenPracticeBatches,
  getLookForwardTimeRange,
  parallelPatients,
  parallelPractices,
} from "../../shared";
import { createElationClient } from "../shared";
import {
  createOrUpdateElationPatientMetadata,
  SyncElationPatientIntoMetriportParams,
} from "./sync-patient";

dayjs.extend(duration);

const lookForward = dayjs.duration(14, "days");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
};

export async function processPatientsFromAppointments(): Promise<void> {
  const cxMappings = await getCxMappingsBySource({ source: EhrSources.elation });
  if (cxMappings.length === 0) {
    out("processPatientsFromAppointments @ Elation").log("No cx mappings found");
    return;
  }

  const secondaryMappingsMap = cxMappings.reduce((acc, cxMapping) => {
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Elation secondary mappings not found", undefined, {
        externalId: cxMapping.externalId,
        source: EhrSources.elation,
      });
    }
    const secondaryMappings = elationSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    return { ...acc, [cxMapping.externalId]: secondaryMappings };
  }, {} as Record<string, ElationSecondaryMappings>);

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.map(mapping => {
    return {
      cxId: mapping.cxId,
      practiceId: mapping.externalId,
    };
  });

  await executeAsynchronously(
    getAppointmentsArgs,
    async (params: GetAppointmentsParams) => {
      const { appointments, error } = await getAppointments(params);
      if (appointments) allAppointments.push(...appointments);
      if (error) getAppointmentsErrors.push({ ...params, error });
    },
    {
      numberOfParallelExecutions: parallelPractices,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  if (getAppointmentsErrors.length > 0) {
    const msg = "Failed to get some appointments @ Elation";
    capture.message(msg, {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors,
        context: "elation.process-patients-from-appointments",
      },
      level: "warning",
    });
  }

  const uniqueAppointments: Appointment[] = uniqBy(allAppointments, "patientId");

  for (const appointment of uniqueAppointments) {
    await createOrUpdateElationPatientMetadata({
      cxId: appointment.cxId,
      elationPracticeId: appointment.practiceId,
      elationPatientId: appointment.patientId,
    });
  }

  const syncPatientsArgs: SyncElationPatientIntoMetriportParams[] = uniqueAppointments.flatMap(
    appointment => {
      const secondaryMappings = secondaryMappingsMap[appointment.practiceId];
      if (!secondaryMappings) {
        throw new MetriportError("Elation secondary mappings not found", undefined, {
          externalId: appointment.practiceId,
          source: EhrSources.elation,
        });
      }
      if (secondaryMappings.backgroundAppointmentPatientProcessingDisabled) return [];
      return [
        {
          cxId: appointment.cxId,
          elationPracticeId: appointment.practiceId,
          elationPatientId: appointment.patientId,
        },
      ];
    }
  );

  await executeAsynchronously(syncPatientsArgs, syncPatient, {
    numberOfParallelExecutions: parallelPatients,
    delay: delayBetweenPatientBatches.asMilliseconds(),
  });
}

async function getAppointments({
  cxId,
  practiceId,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(`Elation getAppointments - cxId ${cxId} practiceId ${practiceId}`);
  const api = await createElationClient({ cxId, practiceId });
  const { startRange, endRange } = getLookForwardTimeRange({ lookForward });
  log(`Getting appointments from ${startRange} to ${endRange}`);
  try {
    const appointments = await api.getAppointments({
      cxId,
      fromDate: startRange,
      toDate: endRange,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: appointment.patient };
      }),
    };
  } catch (error) {
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
    return { error };
  }
}

async function syncPatient({
  cxId,
  elationPracticeId,
  elationPatientId,
}: Omit<SyncElationPatientIntoMetriportParams, "api" | "triggerDq">): Promise<void> {
  const handler = buildEhrSyncPatientHandler();
  await handler.processSyncPatient({
    ehr: EhrSources.elation,
    cxId,
    practiceId: elationPracticeId,
    patientId: elationPatientId,
    triggerDq: true,
  });
}
