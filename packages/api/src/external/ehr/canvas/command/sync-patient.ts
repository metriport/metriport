import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import CanvasApi from "@metriport/core/external/canvas/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { createPatient as createMetriportPatient } from "../../../../command/medical/patient/create-patient";
import {
  getPatientByDemo,
  getPatientOrFail,
} from "../../../../command/medical/patient/get-patient";
import { EhrSources } from "../../shared";
import { collapsePatientDemosFhir, createMetriportPatientDemosFhir } from "../../shared-fhir";
import { createCanvasClient } from "../shared";

const parallelPatientMatches = 5;

export type SyncCanvasPatientIntoMetriportParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  api?: CanvasApi;
  triggerDq?: boolean;
};

type GetPatientByDemoParams = {
  cxId: string;
  demo: PatientDemoData;
};

export async function syncCanvasPatientIntoMetriport({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  api,
  triggerDq = false,
}: SyncCanvasPatientIntoMetriportParams): Promise<string> {
  const { log } = out(
    `Canvas syncCanvasPatientIntoMetriport - cxId ${cxId} canvasPracticeId ${canvasPracticeId} canvasPatientId ${canvasPatientId}`
  );
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  if (existingPatient) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    return metriportPatient.id;
  }

  const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
  const canvasPatient = await canvasApi.getPatient({ cxId, patientId: canvasPatientId });

  const demos = createMetriportPatientDemosFhir(canvasPatient);

  const patients: Patient[] = [];
  const getPatientByDemoErrors: unknown[] = [];
  const getPatientByDemoArgs: GetPatientByDemoParams[] = demos.map(demo => {
    return { cxId, demo };
  });

  await executeAsynchronously(
    getPatientByDemoArgs,
    async (params: GetPatientByDemoParams) => {
      try {
        const patient = await getPatientByDemo(params);
        if (patient) patients.push(patient);
      } catch (error) {
        log(`Failed to get patient by demo. Cause: ${errorToString(error)}`);
        getPatientByDemoErrors.push(error);
      }
    },
    { numberOfParallelExecutions: parallelPatientMatches }
  );

  if (getPatientByDemoErrors.length > 0) {
    const errorsToString = getPatientByDemoErrors.map(e => `Cause: ${errorToString(e)}`).join(",");
    const msg = "Failed to get patient by some demos @ Canvas";
    log(`${msg}. ${errorsToString}`);
    capture.message(msg, {
      extra: {
        cxId,
        canvasPracticeId,
        canvasPatientId,
        getPatientByDemoArgsCount: getPatientByDemoArgs.length,
        errorCount: getPatientByDemoErrors.length,
        errors: getPatientByDemoErrors,
        context: "canvas.sync-patient",
      },
      level: "warning",
    });
  }

  let metriportPatient = patients[0];
  if (metriportPatient) {
    const uniquePatientIds = new Set(patients.map(patient => patient.id));
    if (uniquePatientIds.size > 1) {
      capture.message("Canvas patient mapping to more than one Metriport patient", {
        extra: {
          cxId,
          patientIds: uniquePatientIds,
          context: "canvas.sync-patient",
        },
        level: "warning",
      });
    }
  } else {
    const defaultFacility = await getFacilityMappingOrFail({
      cxId,
      externalId: canvasPracticeId,
      source: EhrSources.canvas,
    });
    metriportPatient = await createMetriportPatient({
      patient: {
        cxId,
        facilityId: defaultFacility.facilityId,
        externalId: canvasPatientId,
        ...collapsePatientDemosFhir(demos),
      },
    });
    if (triggerDq) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatient.id,
      }).catch(processAsyncError("Canvas queryDocumentsAcrossHIEs"));
    }
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  return metriportPatient.id;
}
