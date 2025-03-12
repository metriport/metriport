//import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
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
  SyncElationPatientIntoMetriportParams,
  syncElationPatientIntoMetriport,
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

  const syncPatientsArgs: SyncElationPatientIntoMetriportParams[] = uniqueAppointments.map(
    appointment => {
      return {
        cxId: appointment.cxId,
        elationPracticeId: appointment.practiceId,
        elationPatientId: appointment.patientId,
      };
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
  await syncElationPatientIntoMetriport({
    cxId,
    elationPracticeId,
    elationPatientId,
    triggerDq: true,
  });
  /*
  const handler = buildEhrSyncPatientHandler();
  await handler.processSyncPatient({
    ehr: EhrSources.elation,
    cxId,
    practiceId: elationPracticeId,
    patientId: elationPatientId,
    triggerDq: true,
  });
  */
}
