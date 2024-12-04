import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/athenahealth/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError, errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import {
  Appointment,
  EhrSources,
  createPracticeMap,
  delayBetweenPracticeBatches,
  getLookBackTimeRange,
  parallelPatients,
  parallelPractices,
  parsePracticeMapKey,
} from "../../shared";
import { getAthenaEnv } from "../shared";
import { syncAthenaPatientIntoMetriport } from "./sync-patient";

dayjs.extend(duration);

const catupUpLookBack = dayjs.duration(12, "hours");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  environment: AthenaEnv;
  fromDate?: Date;
  toDate?: Date;
  clientKey: string;
  clientSecret: string;
};

type SyncPatientsParams = {
  cxId: string;
  practiceId: string;
  environment: AthenaEnv;
  appointments: Appointment[];
  clientKey: string;
  clientSecret: string;
};

export async function processPatientsFromAppointmentsSub({ catchUp }: { catchUp: boolean }) {
  const { log } = out(`AthenaHealth processPatientsFromAppointmentsSub - catchUp: ${catchUp}`);
  const { environment, clientKey, clientSecret } = await getAthenaEnv();

  const { startRange, endRange } = catchUp
    ? getLookBackTimeRange({ lookBack: catupUpLookBack })
    : {
        startRange: undefined,
        endRange: undefined,
      };
  if (startRange || endRange) {
    log(`Getting appointments from ${startRange} to ${endRange}`);
  } else {
    log(`Getting appointments with no range`);
  }

  const cxMappings = await getCxMappingsBySource({ source: EhrSources.athena });

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.map(mapping => {
    const cxId = mapping.cxId;
    const practiceId = mapping.externalId;
    const departmentIds = mapping.secondaryMappings?.departmentIds;
    if (departmentIds && !Array.isArray(departmentIds)) {
      throw new MetriportError(
        `AthenaHealth cxMapping departmentIds exists but is malformed`,
        undefined,
        {
          cxId,
          practiceId,
          departmentIds,
        }
      );
    }
    return {
      cxId,
      practiceId,
      departmentIds,
      environment,
      fromDate: startRange,
      toDate: endRange,
      clientKey,
      clientSecret,
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
    capture.error("Failed to get appointments from subscription", {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors
          .map(e => `cxId ${e.cxId} practiceId ${e.practiceId} Cause: ${errorToString(e.error)}`)
          .join(","),
        context: "athenahealth.process-patients-from-appointments-sub",
      },
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
        clientKey,
        clientSecret,
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
    capture.error("Failed to sync patients", {
      extra: {
        syncPatientsArgsCount: uniqueAppointments.length,
        errorCount: syncPatientsErrors.length,
        errors: syncPatientsErrors
          .map(
            e =>
              `cxId ${e.cxId} practiceId ${e.practiceId} patientId ${
                e.patientId
              } Cause: ${errorToString(e.error)}`
          )
          .join(","),
        context: "athenahealth.process-patients-from-appointments-sub",
      },
    });
  }
}

async function getAppointments({
  cxId,
  practiceId,
  departmentIds,
  environment,
  clientKey,
  clientSecret,
  fromDate,
  toDate,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(`AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId}`);
  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: undefined,
    practiceId,
    environment,
    clientKey,
    clientSecret,
  });
  try {
    const appointmentsFromApi = await api.getAppointmentsFromSubscription({
      cxId,
      departmentIds,
      startProcessedDate: fromDate,
      endProcessedDate: toDate,
    });
    return {
      appointments: appointmentsFromApi.map(appointment => {
        return { cxId, practiceId, patientId: appointment.patientid };
      }),
    };
  } catch (error) {
    log(`Failed to get appointments from subscription. Cause: ${errorToString(error)}`);
    return { error };
  }
}

async function syncPatients({
  practiceId,
  environment,
  appointments,
  clientKey,
  clientSecret,
}: SyncPatientsParams): Promise<{ errors: { error: unknown; patientId: string }[] }> {
  const { log } = out(`AthenaHealth syncPatients - practiceId ${practiceId}`);
  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: undefined,
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
        await syncAthenaPatientIntoMetriport({
          cxId: appointment.cxId,
          athenaPracticeId: appointment.practiceId,
          athenaPatientId: appointment.patientId,
          api,
          useSearch: true,
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
