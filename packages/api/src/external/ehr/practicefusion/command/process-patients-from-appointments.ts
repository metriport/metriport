import { AppointmentMethods } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments";
import { buildEhrGetAppointmentsHandler } from "@metriport/core/external/ehr/command/get-appointments/ehr-get-appointments-factory";
import { buildEhrSyncPatientHandler } from "@metriport/core/external/ehr/command/sync-patient/ehr-sync-patient-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { BadRequestError, errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import {
  BookedAppointment,
  practicefusionSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/practicefusion/index";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import {
  Appointment,
  getLookForwardTimeRange,
  maxJitterPatientBatches,
  maxJitterPracticeBatches,
  parallelPatients,
  parallelPractices,
} from "../../shared/utils/appointment";
import { SyncPracticeFusionPatientIntoMetriportParams } from "./sync-patient";

dayjs.extend(duration);

const appointmentsLookForward = dayjs.duration(1, "day");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
};

export async function processPatientsFromAppointments(): Promise<void> {
  const cxMappings = await getCxMappingsBySource({ source: EhrSources.practicefusion });
  if (cxMappings.length === 0) {
    out("processPatientsFromAppointments @ PracticeFusion").log("No cx mappings found");
    return;
  }

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.flatMap(mapping => {
    if (!mapping.secondaryMappings) {
      throw new MetriportError("PracticeFusion secondary mappings not found", undefined, {
        externalId: mapping.externalId,
        source: EhrSources.practicefusion,
      });
    }
    const secondaryMappings = practicefusionSecondaryMappingsSchema.parse(
      mapping.secondaryMappings
    );
    if (secondaryMappings.backgroundAppointmentsDisabled) {
      return [];
    }
    return [
      {
        cxId: mapping.cxId,
        practiceId: mapping.externalId,
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
    const msg = "Failed to get some appointments @ PracticeFusion";
    capture.message(msg, {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors,
        context: "practicefusion.process-patients-from-appointments",
      },
      level: "warning",
    });
  }

  const uniqueAppointments: Appointment[] = uniqBy(allAppointments, "patientId");

  const syncPatientsArgs: SyncPracticeFusionPatientIntoMetriportParams[] = uniqueAppointments.map(
    appointment => {
      return {
        cxId: appointment.cxId,
        practicefusionPracticeId: appointment.practiceId,
        practicefusionPatientId: appointment.patientId,
      };
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
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(`PracticeFusion getAppointments - cxId ${cxId} practiceId ${practiceId}`);
  const { startRange, endRange } = getLookForwardTimeRange({
    lookForward: appointmentsLookForward,
  });
  log(`Getting appointments from ${startRange} to ${endRange}`);
  try {
    const handler = buildEhrGetAppointmentsHandler();
    const appointments = await handler.getAppointments<BookedAppointment>({
      method: AppointmentMethods.practiceFusionGetAppointments,
      cxId,
      practiceId,
      fromDate: startRange,
      toDate: endRange,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: appointment.patientId };
      }),
    };
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) return {};
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
    return { error };
  }
}

async function syncPatient({
  cxId,
  practicefusionPracticeId,
  practicefusionPatientId,
}: Omit<SyncPracticeFusionPatientIntoMetriportParams, "api" | "triggerDq">): Promise<void> {
  const handler = buildEhrSyncPatientHandler();
  await handler.processSyncPatient({
    ehr: EhrSources.practicefusion,
    cxId,
    practiceId: practicefusionPracticeId,
    patientId: practicefusionPatientId,
    triggerDq: true,
    isAppointment: true,
  });
}
