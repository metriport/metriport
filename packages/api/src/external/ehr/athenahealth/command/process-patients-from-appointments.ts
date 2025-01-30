import AthenaHealthApi from "@metriport/core/external/athenahealth/index";
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
  delayBetweenPracticeBatches,
  getLookBackTimeRange,
  getLookForwardTimeRange,
  parallelPatients,
  parallelPractices,
} from "../../shared";
import { createAthenaClient } from "../shared";
import { SyncAthenaPatientParams, syncAthenaPatientIntoMetriport } from "./sync-patient";

dayjs.extend(duration);

const catupUpLookBack = dayjs.duration(12, "hours");
const backFillLookForward = dayjs.duration(14, "days");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  fromDate?: Date;
  toDate?: Date;
  catchUpOrBackFill?: CatchUpOrBackFill;
};

type GetAppointmentsFromApiParams = Pick<
  GetAppointmentsParams,
  "cxId" | "practiceId" | "departmentIds" | "fromDate" | "toDate" | "catchUpOrBackFill"
> & {
  api: AthenaHealthApi;
};

export async function processPatientsFromAppointments(catchUpOrBackFill?: CatchUpOrBackFill) {
  const { log } = out(
    `AthenaHealth processPatientsFromAppointments - catchUpOrBackFill: ${catchUpOrBackFill}`
  );

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
      fromDate: startRange,
      toDate: endRange,
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
    capture.message("Failed to get some appointments @ AthenaHealth", {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors
          .map(e => `cxId ${e.cxId} practiceId ${e.practiceId} Cause: ${errorToString(e.error)}`)
          .join(","),
        context: "athenahealth.process-patients-from-appointments",
        catchUpOrBackFill,
      },
      level: "warning",
    });
  }

  const uniqueAppointments: Appointment[] = uniqBy(allAppointments, "patientId");

  const syncPatientErrors: {
    error: unknown;
    cxId: string;
    athenaPracticeId: string;
    athenaPatientId: string;
  }[] = [];
  const syncPatientArgs: SyncAthenaPatientParams[] = uniqueAppointments.map(appointment => {
    return {
      cxId: appointment.cxId,
      athenaPracticeId: appointment.practiceId,
      athenaPatientId: appointment.patientId,
      triggerDq: true,
    };
  });

  await executeAsynchronously(
    syncPatientArgs,
    async (params: SyncAthenaPatientParams) => {
      const { error } = await syncPatient(params);
      if (error) syncPatientErrors.push({ ...params, error });
    },
    {
      numberOfParallelExecutions: parallelPatients,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  if (syncPatientErrors.length > 0) {
    capture.message("Failed to sync some patients @ AthenaHealth", {
      extra: {
        syncPatientArgsCount: syncPatientArgs.length,
        errorCount: syncPatientErrors.length,
        errors: syncPatientErrors
          .map(
            e =>
              `cxId ${e.cxId} athenaPracticeId ${e.athenaPracticeId} athenaPatientId ${
                e.athenaPatientId
              } Cause: ${errorToString(e.error)}`
          )
          .join(","),
        context: "athenahealth.process-patients-from-appointments",
        catchUpOrBackFill,
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
  catchUpOrBackFill,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error: unknown }> {
  const { log } = out(`AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId}`);
  const api = await createAthenaClient({ cxId, practiceId });
  try {
    const appointments = await getAppointmentsFromApi({
      api,
      cxId,
      practiceId,
      departmentIds,
      fromDate,
      toDate,
      catchUpOrBackFill,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: api.createPatientId(appointment.patientid) };
      }),
      error: undefined,
    };
  } catch (error) {
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
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
      throw new MetriportError("Dates are required for getAppointments @ AthenaHealth", undefined, {
        cxId,
        practiceId,
        catchUpOrBackFill,
      });
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

async function syncPatient({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  triggerDq,
}: SyncAthenaPatientParams): Promise<{ error: unknown }> {
  const { log } = out(
    `AthenaHealth syncPatient - cxId ${cxId} practiceId ${athenaPracticeId} patientId ${athenaPatientId}`
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
