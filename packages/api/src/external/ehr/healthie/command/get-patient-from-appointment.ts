import HealthieApi from "@metriport/core/external/ehr/healthie";
import { createHealthieClient } from "../shared";

export type GetHealthiePatientFromAppointmentParams = {
  cxId: string;
  healthiePracticeId: string;
  healthieAppointmentId: string;
  api?: HealthieApi;
};

export async function getHealthiePatientFromAppointment({
  cxId,
  healthiePracticeId,
  healthieAppointmentId,
  api,
}: GetHealthiePatientFromAppointmentParams): Promise<string | undefined> {
  const healthieApi = api ?? (await createHealthieClient({ cxId, practiceId: healthiePracticeId }));
  const healthieAppointment = await healthieApi.getAppointment({
    cxId,
    appointmentId: healthieAppointmentId,
  });
  if (!healthieAppointment) return undefined;
  const healthiePatientId = healthieAppointment.attendees[0].id;
  return healthiePatientId;
}
