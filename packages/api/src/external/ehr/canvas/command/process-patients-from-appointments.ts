import { buildEhrSyncPatientHandler } from "@metriport/core/command/ehr/sync-patient/ehr-sync-patient-factory";
import { EhrSources } from "@metriport/shared/src/interface/external/ehr/source";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
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
import { createCanvasClient } from "../shared";
import { SyncCanvasPatientIntoMetriportParams } from "./sync-patient";

dayjs.extend(duration);

const lookForward = dayjs.duration(1, "day");

type GetAppointmentsParams = {
  cxId: string;
  practiceId: string;
};

export async function processPatientsFromAppointments(): Promise<void> {
  const cxMappings = await getCxMappingsBySource({ source: EhrSources.canvas });
  if (cxMappings.length === 0) {
    out("processPatientsFromAppointments @ Canvas").log("No cx mappings found");
    return;
  }

  const allAppointments: Appointment[] = [];
  const getAppointmentsErrors: { error: unknown; cxId: string; practiceId: string }[] = [];
  const getAppointmentsArgs: GetAppointmentsParams[] = cxMappings.map(mapping => {
    return {
      cxId: mapping.cxId,
      practiceId: mapping.externalId,
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
    const msg = "Failed to get some appointments @ Canvas";
    capture.message(msg, {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors,
        context: "canvas.process-patients-from-appointments",
      },
      level: "warning",
    });
  }

  const uniqueAppointments: Appointment[] = uniqBy(allAppointments, "patientId");

  const syncPatientsArgs: SyncCanvasPatientIntoMetriportParams[] = uniqueAppointments.map(
    appointment => {
      return {
        cxId: appointment.cxId,
        canvasPracticeId: appointment.practiceId,
        canvasPatientId: appointment.patientId,
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
}: GetAppointmentsParams): Promise<{ appointments?: Appointment[]; error?: unknown }> {
  const { log } = out(`Canvas getAppointments - cxId ${cxId} practiceId ${practiceId}`);
  const api = await createCanvasClient({ cxId, practiceId });
  const { startRange, endRange } = getLookForwardTimeRange({ lookForward });
  log(`Getting appointments from ${startRange} to ${endRange}`);
  try {
    const appointments = await api.getAppointments({
      cxId,
      fromDate: startRange,
      toDate: endRange,
    });
    return {
      appointments: appointments.map(appointment => {
        return { cxId, practiceId, patientId: appointment.patientId };
      }),
    };
  } catch (error) {
    log(`Failed to get appointments. Cause: ${errorToString(error)}`);
    return { error };
  }
}

async function syncPatient({
  cxId,
  canvasPracticeId,
  canvasPatientId,
}: Omit<SyncCanvasPatientIntoMetriportParams, "api" | "triggerDq">): Promise<void> {
  const handler = buildEhrSyncPatientHandler();
  await handler.processSyncPatient({
    ehr: EhrSources.canvas,
    cxId,
    practiceId: canvasPracticeId,
    patientId: canvasPatientId,
    triggerDq: true,
  });
}
