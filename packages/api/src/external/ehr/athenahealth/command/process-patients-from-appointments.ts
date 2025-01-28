import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/athenahealth/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { CatchUpOrBackFill, MetriportError, errorToString } from "@metriport/shared";
import { BookedAppointment } from "@metriport/shared/src/interface/external/athenahealth";
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
  getLookForwardTimeRange,
  parallelPatients,
  parallelPractices,
  parsePracticeMapKey,
} from "../../shared";
import { getAthenaEnv } from "../shared";
import { syncAthenaPatientIntoMetriport } from "./sync-patient";

dayjs.extend(duration);

const catupUpLookBack = dayjs.duration(12, "hours");
const backFillLookForward = dayjs.duration(2, "weeks");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  environment: AthenaEnv;
  fromDate?: Date;
  toDate?: Date;
  clientKey: string;
  clientSecret: string;
  catchUpOrBackFill?: CatchUpOrBackFill;
};

type GetAppointmentsFromApiParams = Pick<
  GetAppointmentsParams,
  "cxId" | "practiceId" | "departmentIds" | "fromDate" | "toDate" | "catchUpOrBackFill"
> & {
  api: AthenaHealthApi;
};

type SyncPatientsParams = {
  cxId: string;
  practiceId: string;
  environment: AthenaEnv;
  appointments: Appointment[];
  clientKey: string;
  clientSecret: string;
};

export async function processPatientsFromAppointments(catchUpOrBackFill?: CatchUpOrBackFill) {
  const { log } = out(
    `AthenaHealth processPatientsFromAppointments - catchUpOrBackFill: ${catchUpOrBackFill}`
  );
  const { environment, clientKey, clientSecret } = await getAthenaEnv();

  const { startRange, endRange } =
    catchUpOrBackFill === "catchUp"
      ? getLookBackTimeRange({ lookBack: catupUpLookBack })
      : catchUpOrBackFill === "backFill"
      ? getLookForwardTimeRange({ lookForward: backFillLookForward })
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
      throw new MetriportError("cxMapping departmentIds is malformed @ AthenaHealth", undefined, {
        cxId,
        practiceId,
      });
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
      catchUpOrBackFill,
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
    capture.error("Failed to get appointments @ AthenaHealth", {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors
          .map(e => `cxId ${e.cxId} practiceId ${e.practiceId} Cause: ${errorToString(e.error)}`)
          .join(","),
        context: "athenahealth.process-patients-from-appointments",
        catchUpOrBackFill,
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
    capture.error("Failed to sync patients @ AthenaHealth", {
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
        context: "athenahealth.process-patients-from-appointments",
        catchUpOrBackFill,
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
  catchUpOrBackFill,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(`AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId}`);
  const api = await AthenaHealthApi.create({
    practiceId,
    environment,
    clientKey,
    clientSecret,
  });
  try {
    const appointmentsFromApi = await getAppointmentsFromApi({
      api,
      cxId,
      practiceId,
      departmentIds,
      fromDate,
      toDate,
      catchUpOrBackFill,
    });
    return {
      appointments: appointmentsFromApi.map(appointment => {
        return { cxId, practiceId, patientId: api.createPatientId(appointment.patientid) };
      }),
    };
  } catch (error) {
    log(`Failed to get appointments from subscription. Cause: ${errorToString(error)}`);
    return { error };
  }
}

async function getAppointmentsFromApi({
  api,
  cxId,
  practiceId,
  departmentIds,
  fromDate,
  toDate,
  catchUpOrBackFill,
}: GetAppointmentsFromApiParams): Promise<BookedAppointment[]> {
  if (catchUpOrBackFill === "backFill") {
    if (!fromDate || !toDate) {
      throw new MetriportError(
        "fromDate and toDate are required for getAppointments @ AthenaHealth",
        undefined,
        {
          cxId,
          practiceId,
          catchUpOrBackFill,
        }
      );
    }
    return await api.getAppointments({
      cxId,
      departmentIds,
      startAppointmentDate: fromDate,
      endAppointmentDate: toDate,
    });
  }
  return await api.getAppointmentsFromSubscription({
    cxId,
    departmentIds,
    startProcessedDate: fromDate,
    endProcessedDate: toDate,
  });
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
