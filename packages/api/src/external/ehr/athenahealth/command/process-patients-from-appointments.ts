import { isAthenaCustomFieldsEnabledForCx } from "@metriport/core/external/aws/app-config";
import AthenaHealthApi from "@metriport/core/external/ehr/athenahealth/index";
import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError, errorToString } from "@metriport/shared";
import {
  AthenaSecondaryMappings,
  BookedAppointment,
} from "@metriport/shared/interface/external/ehr/athenahealth/index";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import { Config } from "../../../../shared/config";
import {
  Appointment,
  delayBetweenPatientBatches,
  delayBetweenPracticeBatches,
  getLookBackTimeRange,
  getLookForwardTimeRange,
  parallelPatients,
  parallelPractices,
} from "../../shared";
import { LookupMode, LookupModes, createAthenaClient } from "../shared";
import { SyncAthenaPatientIntoMetriportParams } from "./sync-patient";

dayjs.extend(duration);

const CUSTOM_APPOINTMENT_TYPE_IDS = Config.isProdEnv()
  ? ["81", "181", "141", "4", "201", "13", "221", "223", "222", "281", "21", "23"]
  : ["2", "1472"];

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
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.flatMap(mapping => {
    if (!mapping.secondaryMappings) {
      throw new MetriportError("Athena secondary mappings not found", undefined, {
        externalId: mapping.externalId,
        source: EhrSources.athena,
      });
    }
    const secondaryMappings = mapping.secondaryMappings as AthenaSecondaryMappings;
    if (secondaryMappings.backgroundAppointmentsDisabled) {
      return [];
    }
    return [
      {
        cxId: mapping.cxId,
        practiceId: mapping.externalId,
        departmentIds: secondaryMappings.departmentIds,
        lookupMode,
      },
    ];
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

  const syncPatientsArgs: SyncAthenaPatientIntoMetriportParams[] = uniqueAppointments.map(
    appointment => {
      return {
        cxId: appointment.cxId,
        athenaPracticeId: appointment.practiceId,
        athenaPatientId: appointment.patientId,
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
  departmentIds,
  lookupMode,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(
    `AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId} departmentIds ${departmentIds} lookupMode ${lookupMode}`
  );
  const api = await createAthenaClient({ cxId, practiceId });
  try {
    let appointments = await getAppointmentsFromApi({
      api,
      cxId,
      departmentIds,
      lookupMode,
      log,
    });
    if (await isAthenaCustomFieldsEnabledForCx(cxId)) {
      appointments = appointments.filter(appointment =>
        CUSTOM_APPOINTMENT_TYPE_IDS.includes(appointment.appointmenttypeid)
      );
    }
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
}: Omit<SyncAthenaPatientIntoMetriportParams, "api" | "triggerDq">): Promise<void> {
  const handler = buildEhrSyncPatientHandler();
  await handler.processSyncPatient({
    ehr: EhrSources.athena,
    cxId,
    practiceId: athenaPracticeId,
    patientId: athenaPatientId,
    triggerDq: true,
  });
}
