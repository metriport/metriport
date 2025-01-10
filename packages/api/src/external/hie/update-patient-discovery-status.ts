import { Patient } from "@metriport/core/domain/patient";
import { DiscoveryParams } from "@metriport/core/domain/patient-discovery";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { MetriportError } from "@metriport/shared";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { LinkStatus } from "../patient-link";
import { getHieDocProgress, getPatientDocProgressFromHies } from "./set-doc-query-progress";
import { getScheduledDqRequestId } from "./shared";

type sharedDqArgs = {
  patient: Patient;
  requestId: string;
  triggerConsolidated?: boolean;
};

/**
 * Sets the CareQuality (CQ) integration status on the patient.
 *
 * @param patient The patient @ Metriport.
 * @param status The status of integrating/synchronizing the patient across CareQuality.
 * @param params.requestId The request ID of integrating/synchronizing the patient across CareQuality.
 * @param params.facilityId The facility ID of integrating/synchronizing the patient across CareQuality.
 * @param params.startedAt The start date of integrating/synchronizing the patient across CareQuality.
 * @param params.rerunPdOnNewDemographics The flag for determining whether to re-run pattient discovery again if new demographic data is found.
 * @param scheduledDqActions The actions to perform when the patient discovery status is completed.
 * @param scheduledDqActions.dq The function to perform when the patient discovery status is completed.
 * @param scheduledDqActions.extraDqArgs The extra arguments to pass to the dq function.
 * @returns
 */
export async function updatePatientDiscoveryStatus<T>({
  patient,
  status,
  source,
  params,
  scheduledDqActions,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: LinkStatus;
  source: MedicalDataSource;
  params?: DiscoveryParams;
  scheduledDqActions?: { dq: (arg: sharedDqArgs & T) => Promise<void>; extraDqArgs: T };
}): Promise<Patient> {
  const { log } = out(
    `${source} updatePatientDiscoveryStatus - patient ${patient.id} requestId ${params?.requestId}`
  );

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
      throw new MetriportError(
        "Cannot update discovery status before assigning discovery params",
        undefined,
        {
          patientId: existingPatient.id,
          source,
        }
      );
    }

    externalData[source] = {
      ...externalData[source],
      [source === MedicalDataSource.CAREQUALITY ? "discoveryStatus" : "status"]: status,
      ...(params !== undefined && { discoveryParams: params }),
    };

    const { scheduledDqRequestId, scheduledDqTriggerConsolidated } = getScheduledDqRequestId({
      patient: existingPatient,
      source,
    });
    if (
      (status === "failed" || status === "completed") &&
      scheduledDqRequestId &&
      scheduledDqActions
    ) {
      if (status == "completed") {
        log(`${source} PD completed - kicking off scheduled DQ ${scheduledDqRequestId}`);
        scheduledDqActions
          .dq({
            patient: existingPatient,
            requestId: scheduledDqRequestId,
            triggerConsolidated: scheduledDqTriggerConsolidated,
            ...scheduledDqActions.extraDqArgs,
          })
          .catch(
            processAsyncError(
              `${source} scheduledDqActions.dq failed - patient ${existingPatient.id} requestId ${scheduledDqRequestId}`
            )
          );
      } else {
        log(`${source} PD failed - failing scheduled DQ ${scheduledDqRequestId}`);
        const hieDocProgress = getHieDocProgress({
          externalHieData: externalData[source],
          downloadProgress: { status: "failed", total: 0 },
          convertProgress: { status: "failed", total: 0 },
        });

        externalData[source] = {
          ...externalData[source],
          documentQueryProgress: hieDocProgress,
        };

        const patientDocProgress = getPatientDocProgressFromHies({
          patient: existingPatient,
          updatedExternalData: externalData,
        });
        existingPatient.data.documentQueryProgress = patientDocProgress;
      }
      externalData[source] = {
        ...externalData[source],
        scheduledDocQueryRequestId: undefined,
        scheduledDocQueryRequestTriggerConsolidated: undefined,
      };
    }

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}
