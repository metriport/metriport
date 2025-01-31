import ElationApi, { ElationEnv } from "@metriport/core/external/elation/index";
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
  createPracticeMap,
  delayBetweenPracticeBatches,
  EhrSources,
  getLookForwardTimeRange,
  parallelPatients,
  parallelPractices,
  parsePracticeMapKey,
} from "../../shared";
import { getElationClientKeyAndSecret, getElationEnv } from "../shared";
import { syncElationPatientIntoMetriport } from "./sync-patient";

dayjs.extend(duration);

const lookForward = dayjs.duration(14, "days");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  environment: ElationEnv;
  fromDate: Date;
  toDate: Date;
};

type SyncPatientsParams = {
  cxId: string;
  practiceId: string;
  environment: ElationEnv;
  appointments: Appointment[];
};

export async function processPatientsFromAppointments(): Promise<void> {
  const { log } = out(`Elation processPatientsFromAppointments`);
  const environment = getElationEnv();

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
      environment,
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
  const uniqueAppointmentsByPractice = createPracticeMap(uniqueAppointments);

  const syncPatientsErrors: {
    error: unknown;
    cxId: string;
    practiceId: string;
    patientId: string;
  }[] = [];
  const syncPatientsArgs: SyncPatientsParams[] = Object.keys(uniqueAppointmentsByPractice).flatMap(
    key => {
      const appointments = uniqueAppointmentsByPractice[key];
      if (!appointments) return [];
      return {
        ...parsePracticeMapKey(key),
        environment,
        appointments,
      };
    }
  );

  await executeAsynchronously(
    syncPatientsArgs,
    async (params: SyncPatientsParams) => {
      const { errors } = await syncPatients(params);
      syncPatientsErrors.push(...errors.map(error => ({ ...error, ...params })));
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
          `cxId ${e.cxId} practiceId ${e.practiceId} patientId ${
            e.patientId
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
  environment,
  fromDate,
  toDate,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(`Elation getAppointments - cxId ${cxId} practiceId ${practiceId}`);
  const { clientKey, clientSecret } = await getElationClientKeyAndSecret({
    cxId,
    practiceId,
  });
  const api = await ElationApi.create({
    practiceId,
    environment,
    clientKey,
    clientSecret,
  });
  try {
    const appointmentsFromApi = await api.getAppointments({
      cxId,
      fromDate,
      toDate,
    });
    return {
      appointments: appointmentsFromApi.map(appointment => {
        return { cxId, practiceId, patientId: appointment.patient };
      }),
    };
  } catch (error) {
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
    return { error };
  }
}

async function syncPatients({
  cxId,
  practiceId,
  environment,
  appointments,
}: SyncPatientsParams): Promise<{ errors: { error: unknown; patientId: string }[] }> {
  const { log } = out(`Elation syncPatients - cxId ${cxId} practiceId ${practiceId}`);
  const { clientKey, clientSecret } = await getElationClientKeyAndSecret({
    cxId,
    practiceId,
  });
  const api = await ElationApi.create({
    practiceId,
    environment,
    clientKey,
    clientSecret,
  });

  const syncPatientErrors: { error: unknown; patientId: string }[] = [];
  await executeAsynchronously(
    appointments,
    async (appointment: Appointment) => {
      try {
        await syncElationPatientIntoMetriport({
          cxId: appointment.cxId,
          elationPracticeId: appointment.practiceId,
          elationPatientId: appointment.patientId,
          api,
          triggerDq: true,
        });
      } catch (error) {
        log(`Failed to sync patient ${appointment.patientId}. Cause: ${errorToString(error)}`);
        syncPatientErrors.push({ error, patientId: appointment.patientId });
      }
    },
    {
      numberOfParallelExecutions: parallelPatients,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  return { errors: syncPatientErrors };
}
