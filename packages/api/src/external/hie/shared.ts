import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { buildDayjs } from "@metriport/shared/common/date";
import { getCQData } from "../carequality/patient";
import { getCWData } from "../commonwell/patient";
import { PatientDataCommonwell } from "../commonwell/patient-shared";
import { PatientDataCarequality } from "../carequality/patient-shared";

const staleLookbackHours = 24;

export function getHieData(
  patient: Patient,
  source: MedicalDataSource
): PatientDataCommonwell | PatientDataCarequality | undefined {
  if (source === MedicalDataSource.COMMONWELL) {
    return getCWData(patient.data.externalData);
  }
  return getCQData(patient.data.externalData);
}

export function getScheduledDqRequestId({
  patient,
  source,
}: {
  patient: Patient;
  source: MedicalDataSource;
}): {
  scheduledDqRequestId: string | undefined;
  scheduledDqTriggerConsolidated: boolean | undefined;
} {
  const hieData = getHieData(patient, source);
  if (!hieData) {
    return {
      scheduledDqRequestId: undefined,
      scheduledDqTriggerConsolidated: undefined,
    };
  }
  const scheduledDqRequestId = hieData.scheduledDocQueryRequestId;
  const scheduledDqTriggerConsolidated = hieData.scheduledDocQueryRequestTriggerConsolidated;
  return { scheduledDqRequestId, scheduledDqTriggerConsolidated };
}

export function isPatientDiscoveryDataMissingOrProcessing({
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

export function isPatientDiscoveryDataStale({
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
