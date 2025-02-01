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

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  fromDate?: Date;
  toDate?: Date;
};

export async function processPatientsFromAppointmentsSub({ catchUp }: { catchUp: boolean }) {
  const { log } = out(`AthenaHealth processPatientsFromAppointmentsSub - catchUp: ${catchUp}`);

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
      throw new MetriportError("cxMapping departmentIds is malformed @ AthenaHealth", undefined, {
        cxId,
        practiceId,
      });
    }
    return {
      cxId,
      practiceId,
      departmentIds,
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
    const msg = "Failed to get some appointments from subscription @ AthenaHealth";
    log(`${msg}. ${errorsToString}`);
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
    const errorsToString = syncPatientsErrors
      .map(
        e =>
          `cxId ${e.cxId} athenaPracticeId ${e.athenaPracticeId} athenaPatientId ${
            e.athenaPatientId
          } Cause: ${errorToString(e.error)}`
      )
      .join(",");
    const msg = "Failed to sync some patients @ AthenaHealth";
    log(`${msg}. ${errorsToString}`);
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
  fromDate,
  toDate,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error: unknown }> {
  const { log } = out(
    `AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId} departmentIds ${departmentIds}`
  );
  const api = await createAthenaClient({ cxId, practiceId });
  try {
    const appointments = await api.getAppointmentsFromSubscription({
      cxId,
      departmentIds,
      startProcessedDate: fromDate,
      endProcessedDate: toDate,
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

async function syncPatient({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  triggerDq,
}: Omit<SyncAthenaPatientIntoMetriportParams, "api">): Promise<{ error: unknown }> {
  const { log } = out(
    `AthenaHealth syncPatient - cxId ${cxId} athenaPracticeId ${athenaPracticeId} patientId ${athenaPatientId}`
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
