import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/athenahealth/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError, errorToString } from "@metriport/shared";
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
  parallelPatients,
  parallelPractices,
  parsePracticeMapKey,
} from "../../shared";
import { getAthenaEnv } from "../shared";
import { syncAthenaPatientIntoMetriport } from "./sync-patient";

dayjs.extend(duration);

const catupUpLookBack = dayjs.duration(12, "hours");

export type LookupMode = "from-subscription" | "from-subscription-backfill" | "appointments";

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  environment: AthenaEnv;
  clientKey: string;
  clientSecret: string;
  lookupMode: LookupMode;
};

type SyncPatientsParams = {
  cxId: string;
  practiceId: string;
  environment: AthenaEnv;
  appointments: Appointment[];
  clientKey: string;
  clientSecret: string;
};

export async function processPatientsFromAppointmentsSub(lookupMode: LookupMode) {
  const { environment, clientKey, clientSecret } = await getAthenaEnv();

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
      clientKey,
      clientSecret,
      lookupMode,
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
  lookupMode,
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
      departmentIds,
      lookupMode,
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

type GetAppointmentsFromApiParams = Omit<
  GetAppointmentsParams,
  "practiceId" | "environment" | "clientKey" | "clientSecret"
> & { api: AthenaHealthApi };

async function getAppointmentsFromApi({
  api,
  cxId,
  departmentIds,
  lookupMode,
}: GetAppointmentsFromApiParams): Promise<BookedAppointment[]> {
  if (lookupMode === "appointments") {
    const { startRange, endRange } = getLookBackTimeRange({ lookBack: catupUpLookBack });
    return await api.getAppointments({
      cxId,
      departmentIds,
      startAppointmentDate: startRange,
      endAppointmentDate: endRange,
    });
  }
  const { startRange, endRange } =
    lookupMode === "from-subscription"
      ? { startRange: undefined, endRange: undefined }
      : getLookBackTimeRange({ lookBack: catupUpLookBack });
  return await api.getAppointmentsFromSubscription({
    cxId,
    departmentIds,
    startProcessedDate: startRange,
    endProcessedDate: endRange,
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
