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
  getLookForwardTimeRange,
  parallelPatients,
  parallelPractices,
} from "../../shared";
import { LookupMode, LookupModes, createAthenaClient } from "../shared";
import {
  SyncAthenaPatientIntoMetriportParams,
  syncAthenaPatientIntoMetriport,
} from "./sync-patient";

dayjs.extend(duration);

const subscriptionBackfillLookBack = dayjs.duration(12, "hours");
const appointmentsLookForward = dayjs.duration(1, "day");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  lookupMode: LookupMode;
};

export async function processPatientsFromAppointments({ lookupMode }: { lookupMode: LookupMode }) {
  const cxMappings = await getCxMappingsBySource({ source: EhrSources.athena });
  if (cxMappings.length === 0) {
    out("processPatientsFromAppointmentsSub @ AthenaHealth").log("No cx mappings found");
    return;
  }

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.map(mapping => {
    return {
      cxId: mapping.cxId,
      practiceId: mapping.externalId,
      departmentIds: mapping.secondaryMappings?.departmentIds,
      lookupMode,
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
    const msg = "Failed to get some appointments @ AthenaHealth";
    capture.message(msg, {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors,
        context: "athenahealth.process-patients-from-appointments",
        lookupMode,
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
        context: "athenahealth.process-patients-from-appointments",
        lookupMode,
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
    `AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId} departmentIds ${departmentIds} lookupMode ${lookupMode}`
  );
  const api = await createAthenaClient({ cxId, practiceId });
  try {
    const appointments = await getAppointmentsFromApi({
      api,
      cxId,
      departmentIds,
      lookupMode,
      log,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: api.createPatientId(appointment.patientid) };
      }),
    };
  } catch (error) {
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
    return { error };
  }
}

type GetAppointmentsFromApiParams = Omit<GetAppointmentsParams, "practiceId"> & {
  api: AthenaHealthApi;
  log: typeof console.log;
};

async function getAppointmentsFromApi({
  api,
  cxId,
  departmentIds,
  lookupMode,
  log,
}: GetAppointmentsFromApiParams): Promise<BookedAppointment[]> {
  if (lookupMode === LookupModes.Appointments) {
    const { startRange, endRange } = getLookForwardTimeRange({
      lookForward: appointmentsLookForward,
    });
    log(`Getting appointments from ${startRange} to ${endRange}`);
    return await api.getAppointments({
      cxId,
      departmentIds,
      startAppointmentDate: startRange,
      endAppointmentDate: endRange,
    });
  }
  if (lookupMode === LookupModes.FromSubscription) {
    log(`Getting change events since last call`);
    return await api.getAppointmentsFromSubscription({ cxId, departmentIds });
  }
  if (lookupMode === LookupModes.FromSubscriptionBackfill) {
    const { startRange, endRange } = getLookBackTimeRange({
      lookBack: subscriptionBackfillLookBack,
    });
    log(`Getting already-processed change events from ${startRange} to ${endRange}`);
    return await api.getAppointmentsFromSubscription({
      cxId,
      departmentIds,
      startProcessedDate: startRange,
      endProcessedDate: endRange,
    });
  }
  throw new MetriportError("Invalid lookup mode @ AthenaHealth", undefined, { cxId, lookupMode });
}

async function syncPatient({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  triggerDq,
}: Omit<SyncAthenaPatientIntoMetriportParams, "api">): Promise<{ error?: unknown }> {
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
    return {};
  } catch (error) {
    log(`Failed to sync patient. Cause: ${errorToString(error)}`);
    return { error };
  }
}
