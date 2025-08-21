import { PatientDemoData } from "@metriport/core/domain/patient";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import {
  getPatientByDemo,
  PatientWithIdentifiers,
} from "../../../../../command/medical/patient/get-patient";
import { collapsePatientDemosFhir } from "../../utils/fhir";
import { handleMetriportSync, HandleMetriportSyncParams } from "../../utils/patient";

const parallelPatientMatches = 5;

type GetPatientByDemoParams = {
  cxId: string;
  demo: PatientDemoData;
};

export async function getOrCreateMetriportPatientFhir({
  source,
  cxId,
  practiceId,
  externalId,
  possibleDemographics,
}: Omit<HandleMetriportSyncParams, "demographics"> & {
  possibleDemographics: PatientDemoData[];
}): Promise<PatientWithIdentifiers> {
  const patients: PatientWithIdentifiers[] = [];
  const getPatientByDemoErrors: { error: unknown; cxId: string; demos: string }[] = [];
  const getPatientByDemoArgs: GetPatientByDemoParams[] = possibleDemographics.map(demo => {
    return { cxId, demo };
  });

  await executeAsynchronously(
    getPatientByDemoArgs,
    async (params: GetPatientByDemoParams) => {
      const { log } = out(`${source} getPatientByDemo - cxId ${cxId}`);
      try {
        const patient = await getPatientByDemo(params);
        if (patient) patients.push(patient);
      } catch (error) {
        const demosToString = JSON.stringify(params.demo);
        log(
          `Failed to get patient by demo for demos ${demosToString}. Cause: ${errorToString(error)}`
        );
        getPatientByDemoErrors.push({ error, ...params, demos: demosToString });
      }
    },
    { numberOfParallelExecutions: parallelPatientMatches }
  );

  if (getPatientByDemoErrors.length > 0) {
    const msg = `Failed to get patient by some demos @ ${source}`;
    capture.message(msg, {
      extra: {
        cxId,
        source,
        practiceId,
        externalId,
        getPatientByDemoArgsCount: getPatientByDemoArgs.length,
        errorCount: getPatientByDemoErrors.length,
        errors: getPatientByDemoErrors,
        context: `${source}.get-metriport-patient-fhir`,
      },
      level: "warning",
    });
  }

  const metriportPatient = patients[0];
  if (metriportPatient) {
    const uniquePatientIds = new Set(patients.map(patient => patient.id));
    if (uniquePatientIds.size > 1) {
      capture.message(`${source} patient mapping to more than one Metriport patient`, {
        extra: {
          cxId,
          practiceId,
          externalId,
          metriportPatientIds: uniquePatientIds,
          context: `${source}.get-metriport-patient-fhir`,
        },
        level: "warning",
      });
    }
    return metriportPatient;
  } else {
    return await handleMetriportSync({
      cxId,
      source,
      practiceId,
      demographics: collapsePatientDemosFhir(possibleDemographics),
      externalId,
    });
  }
}
