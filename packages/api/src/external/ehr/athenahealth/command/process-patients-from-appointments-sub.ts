import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/athenahealth/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError, errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getCxMappingsBySource } from "../../../../command/mapping/cx";
import { EhrSources, getLookackTimeRange } from "../../shared";
import { getPatientIdOrFail } from "./get-patient";
import { getAthenaEnv } from "../shared";

dayjs.extend(duration);

const delayBetweenPracticeBatches = dayjs.duration(30, "seconds");
const catupUpLookback = dayjs.duration(12, "hours");
const parallelPractices = 10;
const parallelPatients = 2;

type PatientAppointment = {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
};

export async function processPatientsFromAppointmentsSub({ catchUp }: { catchUp: boolean }) {
  const { log } = out(`AthenaHealth getPatientIdsOrFailFromAppointmentsSub - catchUp: ${catchUp}`);
  const { environment, clientKey, clientSecret } = await getAthenaEnv();

  const { startRange, endRange } = catchUp
    ? getLookackTimeRange({ lookback: catupUpLookback })
    : {
        startRange: undefined,
        endRange: undefined,
      };
  startRange && endRange && log(`Getting appointments from ${startRange} to ${endRange}`);

  const cxMappings = await getCxMappingsBySource({ source: EhrSources.athena });

  const patientAppointmentsFromGetAppointmentsFromSubByPractice: PatientAppointment[] = [];
  const errorsFromGetAppointmentsFromSubByPractice: string[] = [];
  const argsForGetAppointmentsFromSubByPractice = cxMappings.map(mapping => {
    const cxId = mapping.cxId;
    const practiceId = mapping.externalId;
    const departmentIds = mapping.secondaryMappings?.departmentIds;
    if (departmentIds && !Array.isArray(departmentIds)) {
      throw new MetriportError(
        `AthenaHealth cxMapping departmentIds exists but is malformed`,
        undefined,
        {
          cxId,
          practiceId,
          departmentIds,
        }
      );
    }
    return {
      cxId,
      practiceId,
      departmentIds,
      environment,
      clientKey,
      clientSecret,
      showProcessedStartDateTime: startRange,
      showProcessedEndDateTime: endRange,
      returnArray: patientAppointmentsFromGetAppointmentsFromSubByPractice,
      errorArray: errorsFromGetAppointmentsFromSubByPractice,
      log,
    };
  });

  await executeAsynchronously(
    argsForGetAppointmentsFromSubByPractice,
    getAppointmentsFromSubByPractice,
    {
      numberOfParallelExecutions: parallelPractices,
      delay: delayBetweenPracticeBatches.asMilliseconds(),
    }
  );

  if (errorsFromGetAppointmentsFromSubByPractice.length > 0) {
    capture.error("Failed to get appointments", {
      extra: {
        getAppointmentsArgsCount: errorsFromGetAppointmentsFromSubByPractice.length,
        errorCount: errorsFromGetAppointmentsFromSubByPractice.length,
        errors: errorsFromGetAppointmentsFromSubByPractice.join(","),
        context: "athenahealth.get-patients-from-appointments-sub",
      },
    });
  }

  const patientAppointmentsUnique = [
    ...new Map(
      patientAppointmentsFromGetAppointmentsFromSubByPractice.map(app => [app.athenaPatientId, app])
    ).values(),
  ];
  const patientAppointmentsUniqueByPractice: { [k: string]: PatientAppointment[] } = {};
  patientAppointmentsUnique.map(appointment => {
    const practiceId = appointment.athenaPracticeId;
    if (patientAppointmentsUniqueByPractice[practiceId]) {
      patientAppointmentsUniqueByPractice[practiceId].push(appointment);
    } else {
      patientAppointmentsUniqueByPractice[practiceId] = [appointment];
    }
  });

  const errorsFromGetPatientIdOrFailByPractice: string[] = [];
  const argsForGetPatientIdOrFailByPractice = Object.keys(patientAppointmentsUniqueByPractice).map(
    practiceId => {
      return {
        practiceId,
        environment,
        patientAppointmentsUnique: patientAppointmentsUniqueByPractice[practiceId] ?? [],
        clientKey,
        clientSecret,
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
        context: "athenahealth.get-patients-from-appointments-sub",
      },
    });
  }
}

async function getAppointmentsFromSubByPractice({
  cxId,
  practiceId,
  departmentIds,
  environment,
  clientKey,
  clientSecret,
  showProcessedStartDateTime,
  showProcessedEndDateTime,
  returnArray,
  errorArray,
  log,
}: {
  cxId: string;
  practiceId: string;
  environment: AthenaEnv;
  departmentIds?: string[];
  clientKey: string;
  clientSecret: string;
  showProcessedStartDateTime?: Date;
  showProcessedEndDateTime?: Date;
  returnArray: PatientAppointment[];
  errorArray: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const api = await AthenaHealthApi.create({
      threeLeggedAuthToken: undefined,
      practiceId,
      environment,
      clientKey,
      clientSecret,
    });
    const appointments = await api.getAppointmentsFromSubscription({
      cxId,
      departmentIds,
      showProcessedStartDateTime,
      showProcessedEndDateTime,
    });
    returnArray.push(
      ...appointments.map(appointment => {
        return {
          cxId,
          athenaPracticeId: practiceId,
          athenaPatientId: api.createPatientId(appointment.patientid),
        };
      })
    );
  } catch (error) {
    const cause = `Cause: ${errorToString(error)}`;
    const details = `cxId ${cxId} practiceId ${practiceId} departmentIds ${departmentIds}.`;
    const msg = "Failed to get appointments.";
    log(`${details} ${msg} ${cause}`);
    errorArray.push(`${msg} ${details} ${cause}`);
  }
}

async function getPatientIdOrFailByPractice({
  practiceId,
  environment,
  patientAppointmentsUnique,
  clientKey,
  clientSecret,
  errorArray,
  log,
}: {
  practiceId: string;
  environment: AthenaEnv;
  patientAppointmentsUnique: PatientAppointment[];
  clientKey: string;
  clientSecret: string;
  errorArray: string[];
  log: typeof console.log;
}) {
  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: undefined,
    practiceId,
    environment,
    clientKey,
    clientSecret,
  });

  const argsForGetPatientIdByPatientOrFail = patientAppointmentsUnique.map(appointment => {
    return {
      api,
      cxId: appointment.cxId,
      athenaPracticeId: appointment.athenaPracticeId,
      athenaPatientId: appointment.athenaPatientId,
      useSearch: true,
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
  athenaPracticeId,
  athenaPatientId,
  useSearch,
  triggerDq,
  errorArray,
  log,
}: {
  api: AthenaHealthApi;
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
  useSearch: boolean;
  triggerDq: boolean;
  errorArray: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    await getPatientIdOrFail({
      api,
      cxId,
      athenaPracticeId,
      athenaPatientId,
      useSearch,
      triggerDq,
    });
  } catch (error) {
    const cause = `Cause: ${errorToString(error)}`;
    const details = `cxId ${cxId} athenaPracticeId ${athenaPracticeId} athenaPatientId ${athenaPatientId}.`;
    const msg = "Failed to find or create patients";
    log(`${details} ${msg} ${cause}`);
    errorArray.push(`${msg} ${details} ${cause}`);
  }
}
