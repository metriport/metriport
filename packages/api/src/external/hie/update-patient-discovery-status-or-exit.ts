import { Patient } from "@metriport/core/domain/patient";
import { DiscoveryParams } from "@metriport/core/domain/patient-discovery";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { MetriportError } from "@metriport/shared";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { LinkStatus } from "../patient-link";
import { getScheduledDqRequestId } from "./shared";
import {
  getHieDocProgress,
  getPatientDocProgressFromHies,
  flattenHieDocProgresses,
} from "./set-doc-query-progress";

/**
 * Sets the CareQuality (CQ) integration status on the patient.
 *
 * @param patient The patient @ Metriport.
 * @param status The status of integrating/synchronizing the patient across CareQuality.
 * @param params.requestId The request ID of integrating/synchronizing the patient across CareQuality.
 * @param params.facilityId The facility ID of integrating/synchronizing the patient across CareQuality.
 * @param params.startedAt The start date of integrating/synchronizing the patient across CareQuality.
 * @param params.rerunPdOnNewDemographics The flag for determining whether to re-run pattient discovery again if new demographic data is found.
 * @returns
 */
export async function updatePatientDiscoveryStatusOrExit<T>({
  patient,
  status,
  source,
  params,
  exitActions,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: LinkStatus;
  source: MedicalDataSource;
  params?: DiscoveryParams;
  exitActions?: {
    dq: (
      sharedDqArgs: {
        patient: Patient;
        requestId: string;
        triggerConsolidated?: boolean;
      } & T
    ) => Promise<void>;
    extraDqArgs: T;
  };
}): Promise<Patient> {
  const { log } = out(`${source} updatePatientDiscoveryStatusOrExit - patient ${patient.id}`);

  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    if (!params && !externalData[source]?.discoveryParams) {
      throw new Error(
        `Cannot update discovery status before assigning discovery params @ ${source}`
      );
    }

    externalData[source] = {
      ...externalData[source],
      [source === MedicalDataSource.CAREQUALITY ? "discoveryStatus" : "status"]: status,
      ...(params !== undefined && { discoveryParams: params }),
    };

    if (status === "failed" || status === "completed") {
      const { scheduledDqRequestId, scheduledDocQueryRequestTriggerConsolidated } =
        getScheduledDqRequestId({
          patient: existingPatient,
          source,
        });
      if (scheduledDqRequestId) {
        if (status == "completed") {
          if (!exitActions?.dq) {
            throw new MetriportError(`Cannot trigger document query w/ no dqFunction @ ${source}`, {
              patientId: patient.id,
              source,
              status,
            });
          }

          log(`${source} PD completed - kicking off scheduled DQ ${scheduledDqRequestId}`);
          exitActions.dq({
            patient: existingPatient,
            requestId: scheduledDqRequestId,
            triggerConsolidated: scheduledDocQueryRequestTriggerConsolidated,
            ...exitActions.extraDqArgs,
          });
        } else {
          log(`PD failed - failing scheduled DQ ${scheduledDqRequestId}`);
          const existingHieDocProgress = externalData[source]?.documentQueryProgress ?? {};
          const hieDocProgress = getHieDocProgress(
            existingHieDocProgress,
            { status: "failed", total: 0 },
            { status: "failed", total: 0 }
          );

          externalData[source] = {
            ...externalData[source],
            documentQueryProgress: hieDocProgress,
          };
        }
        externalData[source] = {
          ...externalData[source],
          scheduledDocQueryRequestId: undefined,
          scheduledDocQueryRequestTriggerConsolidated: undefined,
        };
      }
    }

    const existingPatientDocProgress = existingPatient.data.documentQueryProgress ?? {};
    const hieDocProgresses = flattenHieDocProgresses(externalData);

    const patientDocProgress = getPatientDocProgressFromHies(
      existingPatientDocProgress,
      hieDocProgresses
    );

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData,
        documentQueryProgress: patientDocProgress,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}
