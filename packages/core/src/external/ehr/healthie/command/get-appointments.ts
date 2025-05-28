import { BadRequestError, EhrSources } from "@metriport/shared";
import { AppointmentAttendee } from "@metriport/shared/interface/external/ehr/healthie/appointment";
import { GetAppointmentsClientRequest } from "../../command/get-appointments/ehr-get-appointments";
import { createHealthieClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<AppointmentAttendee[]> {
  const { cxId, practiceId, fromDate, toDate, environment } = params;
  if (!fromDate || !toDate) {
    throw new BadRequestError("fromDate and toDate are required", undefined, {
      method: "getAppointments",
      ehr: EhrSources.healthie,
      cxId,
      practiceId,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    });
  }
  const client = await createHealthieClient({
    environment,
    cxId,
    practiceId,
  });
  const appointments = await client.getAppointments({
    cxId,
    startAppointmentDate: fromDate,
    endAppointmentDate: toDate,
  });
  return appointments;
}
