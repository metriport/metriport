import { AthenaEnv } from "@metriport/core/external/ehr/athenahealth/index";
import { buildEhrGetAppointmentsHandler } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments-factory";
import { AppointmentMethods } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments-direct";
import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/command/sync-patient/ehr-sync-patient-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { BadRequestError, MetriportError, NotFoundError, errorToString } from "@metriport/shared";
import {
  AthenaSecondaryMappings,
  BookedAppointment,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/athenahealth/index";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import {
  Appointment,
  delayBetweenPatientBatches,
  delayBetweenPracticeBatches,
  getLookBackTimeRange,
  getLookForwardTimeRange,
  parallelPatients,
  parallelPractices,
} from "../../shared/utils/appointment";
import { LookupMode, LookupModes, createAthenaClientWithTokenIdAndEnvironment } from "../shared";
import { SyncAthenaPatientIntoMetriportParams } from "./sync-patient";

dayjs.extend(duration);

const subscriptionBackfillLookBack = dayjs.duration(12, "hours");
const appointmentsLookForward = dayjs.duration(1, "day");

type AthenaAppointment = Appointment & { departmentId: string };

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  departmentIds?: string[];
  lookupMode: LookupMode;
  appointmentTypesFilter?: string[];
};

export async function processPatientsFromAppointments({ lookupMode }: { lookupMode: LookupMode }) {
  const cxMappings = await getCxMappingsBySource({ source: EhrSources.athena });
  if (cxMappings.length === 0) {
    out("processPatientsFromAppointmentsSub @ AthenaHealth").log("No cx mappings found");
    return;
  }

  const secondaryMappingsMap = cxMappings.reduce((acc, cxMapping) => {
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Athena secondary mappings not found", undefined, {
        externalId: cxMapping.externalId,
        source: EhrSources.athena,
      });
    }
    const secondaryMappings = athenaSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    return { ...acc, [cxMapping.externalId]: secondaryMappings };
  }, {} as Record<string, AthenaSecondaryMappings>);

  const allAppointments: AthenaAppointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.flatMap(mapping => {
    const secondaryMappings = secondaryMappingsMap[mapping.externalId];
    if (!secondaryMappings) {
      throw new MetriportError("Athena secondary mappings not found", undefined, {
        externalId: mapping.externalId,
        source: EhrSources.athena,
      });
    }
    if (
      secondaryMappings.backgroundAppointmentsDisabled &&
      lookupMode === LookupModes.Appointments
    ) {
      return [];
    }
    if (
      secondaryMappings.webhookAppointmentDisabled &&
      (lookupMode === LookupModes.FromSubscription ||
        lookupMode === LookupModes.FromSubscriptionBackfill)
    ) {
      return [];
    }
    return [
      {
        cxId: mapping.cxId,
        practiceId: mapping.externalId,
        departmentIds: secondaryMappings.departmentIds,
        lookupMode,
        appointmentTypesFilter: secondaryMappings.appointmentTypesFilter,
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

  const uniqueAppointments: AthenaAppointment[] = uniqBy(allAppointments, "patientId");

  const syncPatientsArgs: SyncAthenaPatientIntoMetriportParams[] = uniqueAppointments.map(
    appointment => {
      return {
        cxId: appointment.cxId,
        athenaPracticeId: appointment.practiceId,
        athenaPatientId: appointment.patientId,
        athenaDepartmentId: appointment.departmentId,
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
  appointmentTypesFilter,
}: GetAppointmentsParams): Promise<{ appointments?: AthenaAppointment[]; error?: unknown }> {
  const { log } = out(
    `AthenaHealth getAppointments - cxId ${cxId} practiceId ${practiceId} departmentIds ${departmentIds} lookupMode ${lookupMode}`
  );
  const { tokenId, environment, client } = await createAthenaClientWithTokenIdAndEnvironment({
    cxId,
    practiceId,
  });
  try {
    let appointments = await getAppointmentsFromApi({
      environment,
      tokenId,
      cxId,
      practiceId,
      departmentIds,
      lookupMode,
      log,
    });
    if (appointmentTypesFilter) {
      appointments = appointments.filter(appointment =>
        appointmentTypesFilter.includes(appointment.appointmenttypeid)
      );
    }
    return {
      appointments: appointments.map(appointment => {
        return {
          cxId,
          practiceId,
          patientId: client.createPatientId(appointment.patientid),
          departmentId: client.createDepartmentId(appointment.departmentid),
        };
      }),
    };
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) return {};
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
    return { error };
  }
}

type GetAppointmentsFromApiParams = GetAppointmentsParams & {
  environment: AthenaEnv;
  tokenId: string;
  log: typeof console.log;
};

async function getAppointmentsFromApi({
  environment,
  tokenId,
  cxId,
  practiceId,
  departmentIds,
  lookupMode,
  log,
}: GetAppointmentsFromApiParams): Promise<BookedAppointment[]> {
  const handler = buildEhrGetAppointmentsHandler();
  const handlerParams = {
    ehr: EhrSources.athena,
    environment,
    tokenId,
    cxId,
    practiceId,
    departmentIds,
  };
  if (lookupMode === LookupModes.Appointments) {
    const { startRange, endRange } = getLookForwardTimeRange({
      lookForward: appointmentsLookForward,
    });
    log(`Getting appointments from ${startRange} to ${endRange}`);
    return await handler.getAppointments<BookedAppointment>({
      ...handlerParams,
      method: AppointmentMethods.athenaGetAppointments,
      fromDate: startRange,
      toDate: endRange,
    });
  }
  if (lookupMode === LookupModes.FromSubscription) {
    log(`Getting change events since last call`);
    return await handler.getAppointments<BookedAppointment>({
      ...handlerParams,
      method: AppointmentMethods.athenaGetAppointmentFromSubscriptionEvents,
    });
  }
  if (lookupMode === LookupModes.FromSubscriptionBackfill) {
    const { startRange, endRange } = getLookBackTimeRange({
      lookBack: subscriptionBackfillLookBack,
    });
    log(`Getting already-processed change events from ${startRange} to ${endRange}`);
    return await handler.getAppointments<BookedAppointment>({
      ...handlerParams,
      method: AppointmentMethods.athenaGetAppointmentFromSubscriptionEvents,
      fromDate: startRange,
      toDate: endRange,
    });
  }
  throw new MetriportError("Invalid lookup mode @ AthenaHealth", undefined, { cxId, lookupMode });
}

async function syncPatient({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  athenaDepartmentId,
}: Omit<SyncAthenaPatientIntoMetriportParams, "api" | "triggerDq">): Promise<void> {
  const handler = buildEhrSyncPatientHandler();
  await handler.processSyncPatient({
    ehr: EhrSources.athena,
    cxId,
    practiceId: athenaPracticeId,
    patientId: athenaPatientId,
    departmentId: athenaDepartmentId,
    triggerDq: true,
  });
}
