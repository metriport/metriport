import HealthieApi from "@metriport/core/external/ehr/healthie";
import { buildHealthieLinkPatientHandler } from "@metriport/core/external/ehr/healthie/link-patient/healthie-link-patient-factory";
import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError } from "@metriport/shared";
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
  delayBetweenPatientBatches,
  delayBetweenPracticeBatches,
  getLookForwardTimeRange,
  parallelPatients,
  parallelPractices,
} from "../../shared";
import { createHealthieClient, LookupMode, LookupModes } from "../shared";
import {
  SyncHealthiePatientIntoMetriportParams,
  UpdateHealthiePatientQuickNotesParams,
} from "./sync-patient";

dayjs.extend(duration);

const appointmentsLookForward = dayjs.duration(1, "day");
const appointmentsLookForward48hr = dayjs.duration(2, "day");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
  lookupMode: LookupMode;
};

export async function processPatientsFromAppointments({
  lookupMode,
}: {
  lookupMode: LookupMode;
}): Promise<void> {
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
      secondaryMappings.backgroundAppointments48hrDisabled &&
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
      delay: delayBetweenPracticeBatches.asMilliseconds(),
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
    delay: delayBetweenPatientBatches.asMilliseconds(),
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
      if (secondaryMappings.backgroundAppointment48hrPatientProcessingDisabled) return [];
      return [appointment];
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
  lookupMode,
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(
    `Healthie getAppointments - cxId ${cxId} practiceId ${practiceId} lookupMode ${lookupMode}`
  );
  const api = await createHealthieClient({ cxId, practiceId });
  try {
    const appointments = await getAppointmentsFromApi({
      api,
      cxId,
      lookupMode,
      log,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: appointment.attendees[0].id };
      }),
    };
  } catch (error) {
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
    return { error };
  }
}

type GetAppointmentsFromApiParams = Omit<GetAppointmentsParams, "practiceId"> & {
  api: HealthieApi;
  log: typeof console.log;
};

async function getAppointmentsFromApi({
  api,
  cxId,
  lookupMode,
  log,
}: GetAppointmentsFromApiParams): Promise<AppointmentWithAttendee[]> {
  if (lookupMode === LookupModes.Appointments) {
    const { startRange, endRange } = getLookForwardTimeRange({
      lookForward: appointmentsLookForward,
    });
    log(`Getting appointments from ${startRange} to ${endRange}`);
    return await api.getAppointments({
      cxId,
      startAppointmentDate: startRange,
      endAppointmentDate: endRange,
    });
  }
  if (lookupMode === LookupModes.Appointments48hr) {
    const { startRange, endRange } = getLookForwardTimeRange({
      lookForward: appointmentsLookForward48hr,
    });
    log(`Getting appointments from ${startRange} to ${endRange}`);
    return await api.getAppointments({
      cxId,
      startAppointmentDate: startRange,
      endAppointmentDate: endRange,
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
  });
}
