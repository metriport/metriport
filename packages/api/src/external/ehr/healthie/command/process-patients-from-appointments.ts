import { AppointmentMethods } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments";
import { buildEhrGetAppointmentsHandler } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments-factory";
import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/command/sync-patient/ehr-sync-patient-factory";
import { buildHealthieLinkPatientHandler } from "@metriport/core/external/ehr/healthie/command/link-patient/healthie-link-patient-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { BadRequestError, errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import {
  AppointmentWithAttendee,
  HealthieSecondaryMappings,
  healthieSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/healthie/index";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import {
  Appointment,
  getLookForwardTimeRange,
  getLookForwardTimeRangeWithOffset,
  maxJitterPatientBatches,
  maxJitterPracticeBatches,
  parallelPatients,
  parallelPractices,
} from "../../shared/utils/appointment";
import { LookupMode, LookupModes } from "../shared";
import {
  SyncHealthiePatientIntoMetriportParams,
  UpdateHealthiePatientQuickNotesParams,
} from "./sync-patient";

dayjs.extend(duration);

const appointmentsLookForward = dayjs.duration(1, "day");
const oneDayOffset = dayjs.duration(1, "day");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  lookupMode: LookupMode;
};

export async function processPatientsFromAppointments({ lookupMode }: { lookupMode: LookupMode }) {
  const cxMappings = await getCxMappingsBySource({ source: EhrSources.healthie });
  if (cxMappings.length === 0) {
    out("processPatientsFromAppointments @ Healthie").log("No cx mappings found");
    return;
  }

  const secondaryMappingsMap = cxMappings.reduce((acc, cxMapping) => {
    if (!cxMapping.secondaryMappings) {
      throw new MetriportError("Healthie secondary mappings not found", undefined, {
        externalId: cxMapping.externalId,
        source: EhrSources.healthie,
      });
    }
    const secondaryMappings = healthieSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
    return { ...acc, [cxMapping.externalId]: secondaryMappings };
  }, {} as Record<string, HealthieSecondaryMappings>);

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.flatMap(mapping => {
    const secondaryMappings = secondaryMappingsMap[mapping.externalId];
    if (!secondaryMappings) {
      throw new MetriportError("Healthie secondary mappings not found", undefined, {
        externalId: mapping.externalId,
        source: EhrSources.healthie,
      });
    }
    if (
      secondaryMappings.backgroundAppointmentsDisabled &&
      lookupMode === LookupModes.Appointments
    ) {
      return [];
    }
    if (
      !secondaryMappings.backgroundAppointments48hrEnabled &&
      lookupMode === LookupModes.Appointments48hr
    ) {
      return [];
    }
    return [
      {
        cxId: mapping.cxId,
        practiceId: mapping.externalId,
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
      maxJitterMillis: maxJitterPracticeBatches.asMilliseconds(),
    }
  );

  if (getAppointmentsErrors.length > 0) {
    const msg = "Failed to get some appointments @ Healthie";
    capture.message(msg, {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors,
        context: "healthie.process-patients-from-appointments",
        lookupMode,
      },
      level: "warning",
    });
  }

  const uniqueAppointments: Appointment[] = uniqBy(allAppointments, "patientId");

  const linkPatientArgs: UpdateHealthiePatientQuickNotesParams[] = uniqueAppointments.flatMap(
    appointment => {
      return [
        {
          cxId: appointment.cxId,
          healthiePracticeId: appointment.practiceId,
          healthiePatientId: appointment.patientId,
        },
      ];
    }
  );

  await executeAsynchronously(linkPatientArgs, linkPatient, {
    numberOfParallelExecutions: parallelPatients,
    maxJitterMillis: maxJitterPatientBatches.asMilliseconds(),
  });

  const syncPatientsArgs: SyncHealthiePatientIntoMetriportParams[] = linkPatientArgs.flatMap(
    appointment => {
      const secondaryMappings = secondaryMappingsMap[appointment.healthiePracticeId];
      if (!secondaryMappings) {
        throw new MetriportError("Healthie secondary mappings not found", undefined, {
          externalId: appointment.healthiePracticeId,
          source: EhrSources.healthie,
        });
      }
      if (
        secondaryMappings.backgroundAppointmentPatientProcessingDisabled &&
        lookupMode === LookupModes.Appointments
      ) {
        return [];
      }
      if (
        secondaryMappings.backgroundAppointment48hrPatientProcessingDisabled &&
        lookupMode === LookupModes.Appointments48hr
      ) {
        return [];
      }
      return [appointment];
    }
  );

  await executeAsynchronously(syncPatientsArgs, syncPatient, {
    numberOfParallelExecutions: parallelPatients,
    maxJitterMillis: maxJitterPatientBatches.asMilliseconds(),
  });
}

async function getAppointments({
  cxId,
  practiceId,
  lookupMode,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(
    `Healthie getAppointments - cxId ${cxId} practiceId ${practiceId} lookupMode ${lookupMode}`
  );
  try {
    const appointments = await getAppointmentsFromApi({
      cxId,
      practiceId,
      lookupMode,
      log,
    });
    return {
      appointments: appointments.flatMap(appointment => {
        return appointment.attendees.map(attendee => {
          return { cxId, practiceId, patientId: attendee.id };
        });
      }),
    };
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) return {};
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
    return { error };
  }
}

type GetAppointmentsFromApiParams = GetAppointmentsParams & {
  log: typeof console.log;
};

async function getAppointmentsFromApi({
  cxId,
  practiceId,
  lookupMode,
  log,
}: GetAppointmentsFromApiParams): Promise<AppointmentWithAttendee[]> {
  const handler = buildEhrGetAppointmentsHandler();
  const handlerParams = {
    cxId,
    practiceId,
  };
  if (lookupMode === LookupModes.Appointments) {
    const { startRange, endRange } = getLookForwardTimeRange({
      lookForward: appointmentsLookForward,
    });
    log(`Getting appointments from ${startRange} to ${endRange}`);
    return await handler.getAppointments({
      ...handlerParams,
      method: AppointmentMethods.healthieGetAppointments,
      fromDate: startRange,
      toDate: endRange,
    });
  }
  if (lookupMode === LookupModes.Appointments48hr) {
    const { startRange, endRange } = getLookForwardTimeRangeWithOffset({
      lookForward: appointmentsLookForward,
      offset: oneDayOffset,
    });
    log(`Getting appointments from ${startRange} to ${endRange}`);
    return await handler.getAppointments({
      ...handlerParams,
      method: AppointmentMethods.healthieGetAppointments,
      fromDate: startRange,
      toDate: endRange,
    });
  }
  throw new MetriportError("Invalid lookup mode @ Healthie", undefined, { cxId, lookupMode });
}

async function linkPatient({
  cxId,
  healthiePracticeId,
  healthiePatientId,
}: UpdateHealthiePatientQuickNotesParams): Promise<void> {
  const handler = buildHealthieLinkPatientHandler();
  await handler.processLinkPatient({
    cxId,
    practiceId: healthiePracticeId,
    patientId: healthiePatientId,
  });
}

async function syncPatient({
  cxId,
  healthiePracticeId,
  healthiePatientId,
}: Omit<SyncHealthiePatientIntoMetriportParams, "api" | "triggerDq">): Promise<void> {
  const handler = buildEhrSyncPatientHandler();
  await handler.processSyncPatient({
    ehr: EhrSources.healthie,
    cxId,
    practiceId: healthiePracticeId,
    patientId: healthiePatientId,
    triggerDq: true,
    isAppointment: true,
  });
}
