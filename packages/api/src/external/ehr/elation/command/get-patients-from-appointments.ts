import ElationApi, { ElationEnv } from "@metriport/core/external/elation/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getClientKeyMappingOrFail } from "../../../../command/mapping/client-key";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import { Config } from "../../../../shared/config";
import { EhrSources, getLookforwardTimeRange } from "../../shared";
import { getPatientIdOrFail as singleGetPatientIdOrFail } from "./get-patient";

dayjs.extend(duration);

const delayBetweenPracticeBatches = dayjs.duration(0, "seconds");
const lookforward = dayjs.duration(14, "days");
const parallelPractices = 10;
const parallelPatients = 2;

const elationEnvironment = Config.getElationEnv();

type PatientAppointment = {
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
};

export async function getPatientIdsOrFailFromAppointments(): Promise<void> {
  const { log } = out(`Elation getPatientIdsOrFailFromAppointments`);
  if (!elationEnvironment) throw new MetriportError("Elation not setup");

  const { startRange, endRange } = getLookforwardTimeRange({
    lookforward,
    log,
  });

  const cxMappings = await getCxMappingsBySource({ source: EhrSources.elation });

  const patientAppointments: PatientAppointment[] = [];
  const getAppointmentsErrors: string[] = [];
  const getAppointmentsArgs = cxMappings.map(mapping => {
    const cxId = mapping.cxId;
    const practiceId = mapping.externalId;
    return {
      cxId,
      practiceId,
      patientAppointments,
      fromDate: startRange,
      toDate: endRange,
      errors: getAppointmentsErrors,
      log,
    };
  });

  await executeAsynchronously(getAppointmentsArgs, getAppointmentsByPractice, {
    numberOfParallelExecutions: parallelPractices,
    delay: delayBetweenPracticeBatches.asMilliseconds(),
  });

  if (getAppointmentsErrors.length > 0) {
    capture.error("Failed to get appointments", {
      extra: {
        getAppointmentsArgsCount: getAppointmentsArgs.length,
        errorCount: getAppointmentsErrors.length,
        errors: getAppointmentsErrors.join(","),
        context: "elation.get-patients-from-appointments",
      },
    });
  }

  const patientAppointmentsUnique = [
    ...new Map(patientAppointments.map(app => [app.elationPatientId, app])).values(),
  ];
  const patientAppointmentsUniqueByPractice: { [k: string]: PatientAppointment[] } = {};
  patientAppointmentsUnique.map(appointment => {
    const cxId = appointment.cxId;
    const practiceId = appointment.elationPracticeId;
    const key = createMapKey(cxId, practiceId);
    if (patientAppointmentsUniqueByPractice[key]) {
      patientAppointmentsUniqueByPractice[key].push(appointment);
    } else {
      patientAppointmentsUniqueByPractice[key] = [appointment];
    }
  });
  const getPatientIdOrFailErrors: string[] = [];
  const getPatientIdOrFaiLByPracticeArgs = Object.keys(patientAppointmentsUniqueByPractice).map(
    key => {
      const { cxId, practiceId } = parseMapKey(key);
      return {
        cxId,
        practiceId,
        patientAppointmentsUnique: patientAppointmentsUniqueByPractice[key] ?? [],
        errors: getPatientIdOrFailErrors,
        log,
      };
    }
  );

  await executeAsynchronously(getPatientIdOrFaiLByPracticeArgs, getPatientIdOrFailByPractice, {
    numberOfParallelExecutions: parallelPractices,
    delay: delayBetweenPracticeBatches.asMilliseconds(),
  });

  if (getPatientIdOrFailErrors.length > 0) {
    capture.error("Failed to find or create patients", {
      extra: {
        getPatientIdOrFailArgsCount: patientAppointmentsUnique.length,
        errorCount: getPatientIdOrFailErrors.length,
        errors: getPatientIdOrFailErrors.join(","),
        context: "elation.get-patients-from-appointments",
      },
    });
  }
}

async function getAppointmentsByPractice({
  cxId,
  practiceId,
  patientAppointments,
  fromDate,
  toDate,
  errors,
  log,
}: {
  cxId: string;
  practiceId: string;
  patientAppointments: PatientAppointment[];
  fromDate: Date;
  toDate: Date;
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const { clientKey, clientSecret } = await getClientKeyMappingOrFail({
      cxId,
      source: EhrSources.elation,
      externalId: practiceId,
    });
    const api = await ElationApi.create({
      practiceId,
      environment: elationEnvironment as ElationEnv,
      clientKey,
      clientSecret,
    });
    const appointments = await api.getAppointments({
      cxId,
      fromDate,
      toDate,
    });
    patientAppointments.push(
      ...appointments.map(appointment => {
        return {
          cxId,
          elationPracticeId: practiceId,
          elationPatientId: appointment.patient,
        };
      })
    );
  } catch (error) {
    const cause = `Cause: ${errorToString(error)}`;
    const details = `cxId ${cxId} practiceId ${practiceId}.`;
    const msg = "Failed to get appointments.";
    log(`${details} ${msg} ${cause}`);
    errors.push(`${msg} ${details} ${cause}`);
  }
}

async function getPatientIdOrFailByPractice({
  cxId,
  practiceId,
  patientAppointmentsUnique,
  errors,
  log,
}: {
  cxId: string;
  practiceId: string;
  patientAppointmentsUnique: PatientAppointment[];
  errors: string[];
  log: typeof console.log;
}) {
  const { clientKey, clientSecret } = await getClientKeyMappingOrFail({
    cxId,
    source: EhrSources.elation,
    externalId: practiceId,
  });
  const api = await ElationApi.create({
    practiceId,
    environment: elationEnvironment as ElationEnv,
    clientKey,
    clientSecret,
  });
  const getPatientIdOrFaiLArgs = patientAppointmentsUnique.map(appointment => {
    return {
      api,
      cxId: appointment.cxId,
      elationPracticeId: appointment.elationPracticeId,
      elationPatientId: appointment.elationPatientId,
      errors,
      log,
    };
  });

  await executeAsynchronously(getPatientIdOrFaiLArgs, getPatientIdOrFail, {
    numberOfParallelExecutions: parallelPatients,
    delay: delayBetweenPracticeBatches.asMilliseconds(),
  });
}

async function getPatientIdOrFail({
  api,
  cxId,
  elationPracticeId,
  elationPatientId,
  errors,
  log,
}: {
  api: ElationApi;
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    await singleGetPatientIdOrFail({
      api,
      cxId,
      elationPracticeId,
      elationPatientId,
    });
  } catch (error) {
    const cause = `Cause: ${errorToString(error)}`;
    const details = `cxId ${cxId} elationPracticeId ${elationPracticeId} elationPatientId ${elationPatientId}.`;
    const msg = "Failed to find or create patients";
    log(`${details} ${msg} ${cause}`);
    errors.push(`${msg} ${details} ${cause}`);
  }
}

function createMapKey(cxId: string, practiceId: string): string {
  return `${cxId}|${practiceId}`;
}

function parseMapKey(key: string): { cxId: string; practiceId: string } {
  const [cxId, practiceId] = key.split("|");
  if (!cxId || !practiceId) throw new MetriportError(`Invalid map key ${key}`, undefined, { key });
  return { cxId, practiceId };
}
