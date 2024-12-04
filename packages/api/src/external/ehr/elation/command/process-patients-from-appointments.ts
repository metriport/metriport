import ElationApi, { ElationEnv } from "@metriport/core/external/elation/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import { EhrSources, getLookforwardTimeRange } from "../../shared";
import { getElationClientKeyAndSecret, getElationEnv, MAP_KEY_SEPARATOR } from "../shared";
import { getPatientIdOrFail } from "./get-patient";

dayjs.extend(duration);

const delayBetweenPracticeBatches = dayjs.duration(0, "seconds");
const lookforward = dayjs.duration(14, "days");
const parallelPractices = 10;
const parallelPatients = 2;

type PatientAppointment = {
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
};

export async function processPatientsFromAppointments(): Promise<void> {
  const { log } = out(`Elation processPatientIdsOrFailFromAppointments`);
  const elationEnvironment = getElationEnv();

  const { startRange, endRange } = getLookforwardTimeRange({ lookforward });
  log(`Getting appointments from ${startRange} to ${endRange}`);

  const cxMappings = await getCxMappingsBySource({ source: EhrSources.elation });

  const patientAppointmentsFromGetAppointmentsByPractice: PatientAppointment[] = [];
  const errorsFromGetAppointmentsByPractice: string[] = [];
  const argsForGetAppointmentsByPractice = cxMappings.map(mapping => {
    const cxId = mapping.cxId;
    const practiceId = mapping.externalId;
    return {
      cxId,
      practiceId,
      environment: elationEnvironment,
      fromDate: startRange,
      toDate: endRange,
      returnArray: patientAppointmentsFromGetAppointmentsByPractice,
      errorArray: errorsFromGetAppointmentsByPractice,
      log,
    };
  });

  await executeAsynchronously(argsForGetAppointmentsByPractice, getAppointmentsByPractice, {
    numberOfParallelExecutions: parallelPractices,
    delay: delayBetweenPracticeBatches.asMilliseconds(),
  });

  if (errorsFromGetAppointmentsByPractice.length > 0) {
    capture.error("Failed to get appointments", {
      extra: {
        getAppointmentsArgsCount: errorsFromGetAppointmentsByPractice.length,
        errorCount: errorsFromGetAppointmentsByPractice.length,
        errors: errorsFromGetAppointmentsByPractice.join(","),
        context: "elation.get-patients-from-appointments",
      },
    });
  }

  const patientAppointmentsUnique = [
    ...new Map(
      patientAppointmentsFromGetAppointmentsByPractice.map(app => [app.elationPatientId, app])
    ).values(),
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

  const errorsFromGetPatientIdOrFailByPractice: string[] = [];
  const argsForGetPatientIdOrFailByPractice = Object.keys(patientAppointmentsUniqueByPractice).map(
    key => {
      const { cxId, practiceId } = parseMapKey(key);
      return {
        cxId,
        practiceId,
        environment: elationEnvironment,
        patientAppointmentsUnique: patientAppointmentsUniqueByPractice[key] ?? [],
        errorArray: errorsFromGetPatientIdOrFailByPractice,
        log,
      };
    }
  );

  await executeAsynchronously(argsForGetPatientIdOrFailByPractice, getPatientIdOrFailByPractice, {
    numberOfParallelExecutions: parallelPractices,
    delay: delayBetweenPracticeBatches.asMilliseconds(),
  });

  if (errorsFromGetPatientIdOrFailByPractice.length > 0) {
    capture.error("Failed to find or create patients", {
      extra: {
        getPatientIdOrFailArgsCount: patientAppointmentsUnique.length,
        errorCount: errorsFromGetPatientIdOrFailByPractice.length,
        errors: errorsFromGetPatientIdOrFailByPractice.join(","),
        context: "elation.get-patients-from-appointments",
      },
    });
  }
}

async function getAppointmentsByPractice({
  cxId,
  practiceId,
  environment,
  fromDate,
  toDate,
  returnArray,
  errorArray,
  log,
}: {
  cxId: string;
  practiceId: string;
  environment: ElationEnv;
  fromDate: Date;
  toDate: Date;
  returnArray: PatientAppointment[];
  errorArray: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const { clientKey, clientSecret } = await getElationClientKeyAndSecret({
      cxId,
      practiceId,
    });
    const api = await ElationApi.create({
      practiceId,
      environment,
      clientKey,
      clientSecret,
    });
    const appointments = await api.getAppointments({
      cxId,
      fromDate,
      toDate,
    });
    returnArray.push(
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
    errorArray.push(`${msg} ${details} ${cause}`);
  }
}

async function getPatientIdOrFailByPractice({
  cxId,
  practiceId,
  environment,
  patientAppointmentsUnique,
  errorArray,
  log,
}: {
  cxId: string;
  practiceId: string;
  environment: ElationEnv;
  patientAppointmentsUnique: PatientAppointment[];
  errorArray: string[];
  log: typeof console.log;
}) {
  const { clientKey, clientSecret } = await getElationClientKeyAndSecret({
    cxId,
    practiceId,
  });
  const api = await ElationApi.create({
    practiceId,
    environment,
    clientKey,
    clientSecret,
  });
  const argsForGetPatientIdByPatientOrFail = patientAppointmentsUnique.map(appointment => {
    return {
      api,
      cxId: appointment.cxId,
      elationPracticeId: appointment.elationPracticeId,
      elationPatientId: appointment.elationPatientId,
      triggerDq: true,
      errorArray,
      log,
    };
  });

  await executeAsynchronously(argsForGetPatientIdByPatientOrFail, getPatientIdOrFailByPatient, {
    numberOfParallelExecutions: parallelPatients,
    delay: delayBetweenPracticeBatches.asMilliseconds(),
  });
}

async function getPatientIdOrFailByPatient({
  api,
  cxId,
  elationPracticeId,
  elationPatientId,
  triggerDq,
  errorArray,
  log,
}: {
  api: ElationApi;
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
  triggerDq: boolean;
  errorArray: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    await getPatientIdOrFail({
      api,
      cxId,
      elationPracticeId,
      elationPatientId,
      triggerDq,
    });
  } catch (error) {
    const cause = `Cause: ${errorToString(error)}`;
    const details = `cxId ${cxId} elationPracticeId ${elationPracticeId} elationPatientId ${elationPatientId}.`;
    const msg = "Failed to find or create patients";
    log(`${details} ${msg} ${cause}`);
    errorArray.push(`${msg} ${details} ${cause}`);
  }
}

function createMapKey(cxId: string, practiceId: string): string {
  return `${cxId}${MAP_KEY_SEPARATOR}${practiceId}`;
}

function parseMapKey(key: string): { cxId: string; practiceId: string } {
  const [cxId, practiceId] = key.split(MAP_KEY_SEPARATOR);
  if (!cxId || !practiceId) throw new MetriportError(`Invalid map key ${key}`, undefined, { key });
  return { cxId, practiceId };
}
