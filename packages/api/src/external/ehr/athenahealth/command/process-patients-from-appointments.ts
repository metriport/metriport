import AthenaHealthApi from "@metriport/core/external/athenahealth/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError, errorToString } from "@metriport/shared";
import { BookedAppointment } from "@metriport/shared/src/interface/external/athenahealth/index";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import {
  Appointment,
  EhrSources,
  delayBetweenPracticeBatches,
  getLookBackTimeRange,
  parallelPatients,
  parallelPractices,
} from "../../shared";
import { createAthenaClient } from "../shared";
import {
  SyncAthenaPatientIntoMetriportParams,
  syncAthenaPatientIntoMetriport,
} from "./sync-patient";

dayjs.extend(duration);

const catupUpLookBack = dayjs.duration(12, "hours");

enum LookupMode {
  FromSubscription = "from-subscription",
  FromSubscriptionBackfill = "from-subscription-backfill",
  Appointments = "appointments",
}

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  lookupMode: LookupMode;
};

export async function processPatientsFromAppointments({ lookupMode }: { lookupMode: LookupMode }) {
  const { log } = out(`AthenaHealth processPatientsFromAppointments - lookupMode: ${lookupMode}`);

  const cxMappings = await getCxMappingsBySource({ source: EhrSources.athena });

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.map(mapping => {
    const cxId = mapping.cxId;
    const practiceId = mapping.externalId;
    const departmentIds = mapping.secondaryMappings?.departmentIds;
    if (departmentIds && !Array.isArray(departmentIds)) {
      const msg = "CxMapping departmentIds is malformed @ AthenaHealth";
      log(
        `${msg}. cxId ${cxId} practiceId ${practiceId} departmentIds ${JSON.stringify(
          departmentIds
        )}`
      );
      throw new MetriportError(msg, undefined, {
        cxId,
        practiceId,
      });
    }
    return {
      cxId,
      practiceId,
      departmentIds,
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
    const msg = "Failed to get some appointments from subscription @ AthenaHealth";
    capture.message(msg, {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors,
        context: "athenahealth.process-patients-from-appointments-sub",
      },
      level: "warning",
    });
  }

  const uniqueAppointments: Appointment[] = uniqBy(allAppointments, "patientId");

  const syncPatientsErrors: {
    error: unknown;
    cxId: string;
    athenaPracticeId: string;
    athenaPatientId: string;
  }[] = [];
  const syncPatientsArgs: SyncAthenaPatientIntoMetriportParams[] = uniqueAppointments.map(
    appointment => {
      return {
        cxId: appointment.cxId,
        athenaPracticeId: appointment.practiceId,
        athenaPatientId: appointment.patientId,
        triggerDq: true,
      };
    }
  );

  await executeAsynchronously(
    syncPatientsArgs,
    async (params: SyncAthenaPatientIntoMetriportParams) => {
      const { error } = await syncPatient(params);
      if (error) syncPatientsErrors.push({ ...params, error });
    },
    {
      numberOfParallelExecutions: parallelPatients,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  if (syncPatientsErrors.length > 0) {
    const msg = "Failed to sync some patients @ AthenaHealth";
    capture.message(msg, {
      extra: {
        syncPatientsArgsCount: uniqueAppointments.length,
        errorCount: syncPatientsErrors.length,
        errors: syncPatientsErrors,
        context: "athenahealth.process-patients-from-appointments-sub",
      },
      level: "warning",
    });
  }
}

async function getAppointments({
  cxId,
  practiceId,
  departmentIds,
  lookupMode,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error: unknown }> {
  const { log } = out(
    `AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId} departmentIds ${departmentIds}`
  );
  const api = await createAthenaClient({ cxId, practiceId });
  try {
    const appointments = await getAppointmentsFromApi({
      api,
      cxId,
      departmentIds,
      lookupMode,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: api.createPatientId(appointment.patientid) };
      }),
      error: undefined,
    };
  } catch (error) {
    log(`Failed to get appointments from ${fromDate} to ${toDate}. Cause: ${errorToString(error)}`);
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

async function syncPatient({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  triggerDq,
}: Omit<SyncAthenaPatientIntoMetriportParams, "api">): Promise<{ error: unknown }> {
  const { log } = out(
    `AthenaHealth syncPatient - cxId ${cxId} athenaPracticeId ${athenaPracticeId} athenaPatientId ${athenaPatientId}`
  );
  const api = await createAthenaClient({ cxId, practiceId: athenaPracticeId });
  try {
    await syncAthenaPatientIntoMetriport({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      api,
      triggerDq,
    });
    return { error: undefined };
  } catch (error) {
    log(`Failed to sync patient. Cause: ${errorToString(error)}`);
    return { error };
  }
}
