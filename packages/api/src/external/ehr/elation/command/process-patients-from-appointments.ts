import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import {
  Appointment,
  delayBetweenPracticeBatches,
  EhrSources,
  getLookForwardTimeRange,
  parallelPractices,
} from "../../shared";
import { createElationClient } from "../shared";
import {
  syncElationPatientIntoMetriport,
  SyncElationPatientIntoMetriportParams,
} from "./sync-patient";

dayjs.extend(duration);

const lookForward = dayjs.duration(14, "days");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  fromDate: Date;
  toDate: Date;
};

export async function processPatientsFromAppointments(): Promise<void> {
  const { log } = out(`Elation processPatientsFromAppointments`);

  const { startRange, endRange } = getLookForwardTimeRange({ lookForward });
  log(`Getting appointments from ${startRange} to ${endRange}`);

  const cxMappings = await getCxMappingsBySource({ source: EhrSources.elation });

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.map(mapping => {
    const cxId = mapping.cxId;
    const practiceId = mapping.externalId;
    return {
      cxId,
      practiceId,
      fromDate: startRange,
      toDate: endRange,
    };
  });

  await executeAsynchronously(
    getAppointmentsArgs,
    async (params: GetAppointmentsParams) => {
      const { appointments, error } = await getAppointments(params);
      if (appointments) allAppointments.push(...appointments);
      if (error) getAppointmentsErrors.push({ error, ...params });
    },
    {
      numberOfParallelExecutions: parallelPractices,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  if (getAppointmentsErrors.length > 0) {
    const errorsToString = getAppointmentsErrors
      .map(e => `cxId ${e.cxId} practiceId ${e.practiceId}. Cause: ${errorToString(e.error)}`)
      .join(",");
    const msg = "Failed to get some appointments @ Elation";
    log(`${msg}. ${errorsToString}`);
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

  const syncPatientsErrors: {
    error: unknown;
    cxId: string;
    elationPracticeId: string;
    elationPatientId: string;
  }[] = [];
  const syncPatientsArgs: SyncElationPatientIntoMetriportParams[] = uniqueAppointments.map(
    appointment => {
      return {
        cxId: appointment.cxId,
        elationPracticeId: appointment.practiceId,
        elationPatientId: appointment.patientId,
        triggerDq: true,
      };
    }
  );

  await executeAsynchronously(
    syncPatientsArgs,
    async (params: SyncElationPatientIntoMetriportParams) => {
      const { error } = await syncPatient(params);
      if (error) syncPatientsErrors.push({ ...params, error });
    },
    {
      numberOfParallelExecutions: parallelPractices,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  if (syncPatientsErrors.length > 0) {
    const errorsToString = syncPatientsErrors
      .map(
        e =>
          `cxId ${e.cxId} elationPracticeId ${e.elationPracticeId} elationPatientId ${
            e.elationPatientId
          }. Cause: ${errorToString(e.error)}`
      )
      .join(",");
    const msg = "Failed to sync some patients @ Elation";
    log(`${msg}. ${errorsToString}`);
    capture.message(msg, {
      extra: {
        syncPatientsArgsCount: uniqueAppointments.length,
        errorCount: syncPatientsErrors.length,
        errors: syncPatientsErrors,
        context: "elation.process-patients-from-appointments",
      },
      level: "warning",
    });
  }
}

async function getAppointments({
  cxId,
  practiceId,
  fromDate,
  toDate,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error: unknown }> {
  const { log } = out(`Elation getAppointments - cxId ${cxId} practiceId ${practiceId}`);
  const api = await createElationClient({ cxId, practiceId });
  try {
    const appointments = await api.getAppointments({
      cxId,
      fromDate,
      toDate,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: appointment.patient };
      }),
      error: undefined,
    };
  } catch (error) {
    log(`Failed to get appointments from ${fromDate} to ${toDate}. Cause: ${errorToString(error)}`);
    return { error };
  }
}

async function syncPatient({
  cxId,
  elationPracticeId,
  elationPatientId,
  triggerDq,
}: Omit<SyncElationPatientIntoMetriportParams, "api">): Promise<{ error: unknown }> {
  const { log } = out(
    `Elation syncPatient - cxId ${cxId} elationPracticeId ${elationPracticeId} elationPatientId ${elationPatientId}`
  );
  const api = await createElationClient({ cxId, practiceId: elationPracticeId });
  try {
    await syncElationPatientIntoMetriport({
      cxId,
      elationPracticeId,
      elationPatientId,
      api,
      triggerDq,
    });
    return { error: undefined };
  } catch (error) {
    log(`Failed to sync patient. Cause: ${errorToString(error)}`);
    return { error };
  }
}
