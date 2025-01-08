import { buildDayjs } from "@metriport/shared/common/date";
import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getCWData } from "../commonwell/patient";
import { getCQData } from "../carequality/patient";
import { isStalePatientUpdateEnabledForCx } from "../aws/app-config";
import { PatientDataCommonwell } from "../commonwell/patient-shared";
import { PatientDataCarequality } from "../carequality/patient-shared";

const staleLookbackHours = 24;

/**
 * Stores the requestId as the scheduled document query to be executed when the patient discovery
 * is completed.
 */
export async function scheduleDocQuery({
  cxId,
  requestId,
  patient,
  source,
  triggerConsolidated,
  forceScheduling = false,
  forcePatientDiscovery = false,
}: {
  cxId: string;
  requestId: string;
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  triggerConsolidated?: boolean;
  forceScheduling?: boolean;
  forcePatientDiscovery?: boolean;
}): Promise<{ isScheduled: boolean; runPatientDiscovery: boolean }> {
  const { log } = out(`${source} DQ - requestId ${requestId}, patient ${patient.id}`);

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

    const { hasNoHieStatus, hieStatusProcessing } = isPatientPdDataMissingOrProcessing({
      patient: existingPatient,
      source,
    });
    const isStalePatientUpdateEnabled = await isStalePatientUpdateEnabledForCx(cxId);
    const isStale =
      isStalePatientUpdateEnabled &&
      isPatientStale({
        patient: existingPatient,
        source,
      });

    if (hasNoHieStatus || hieStatusProcessing || isStale || forceScheduling) {
      log(`Scheduling document query to be executed`);

      const updatedExternalData = {
        ...externalData,
        [source]: {
          ...externalData[source],
          scheduledDocQueryRequestId: requestId,
          ...(triggerConsolidated !== undefined && {
            scheduledDocQueryRequestTriggerConsolidated: triggerConsolidated,
          }),
        },
      };
      const updatedPatient = {
        ...existingPatient.dataValues,
        data: {
          ...existingPatient.data,
          externalData: updatedExternalData,
        },
      };
      await PatientModel.update(updatedPatient, {
        where: patientFilter,
        transaction,
      });

      const runPatientDiscovery = (forcePatientDiscovery || isStale) && !hieStatusProcessing;

      return { isScheduled: true, runPatientDiscovery };
    }

    log(`Scheduling skipped`);

    return { isScheduled: false, runPatientDiscovery: false };
  });
}

function getHieData(
  patient: Patient,
  source: MedicalDataSource
): PatientDataCommonwell | PatientDataCarequality | undefined {
  if (source === MedicalDataSource.COMMONWELL) {
    return getCWData(patient.data.externalData);
  }
  return getCQData(patient.data.externalData);
}

function isPatientPdDataMissingOrProcessing({
  patient,
  source,
}: {
  patient: Patient;
  source: MedicalDataSource;
}): { hasNoHieStatus: boolean; hieStatusProcessing: boolean } {
  const hieData = getHieData(patient, source);
  if (!hieData) return { hasNoHieStatus: true, hieStatusProcessing: false };
  const hieStatus =
    source === MedicalDataSource.COMMONWELL
      ? (hieData as PatientDataCommonwell).status
      : (hieData as PatientDataCarequality).discoveryStatus;
  if (!hieStatus) return { hasNoHieStatus: true, hieStatusProcessing: false };
  const hieStatusProcessing = hieStatus === "processing";
  return { hasNoHieStatus: false, hieStatusProcessing };
}

function isPatientStale({
  patient,
  source,
}: {
  patient: Patient;
  source: MedicalDataSource;
}): boolean {
  const now = buildDayjs(new Date());
  const patientCreatedAt = buildDayjs(patient.createdAt);
  const hieData = getHieData(patient, source);
  const pdStartedAt = hieData?.discoveryParams?.startedAt
    ? buildDayjs(hieData.discoveryParams.startedAt)
    : undefined;
  return (pdStartedAt ?? patientCreatedAt) < now.subtract(staleLookbackHours, "hours");
}
