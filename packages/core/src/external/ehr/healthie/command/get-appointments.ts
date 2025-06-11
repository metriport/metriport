import { BadRequestError, EhrSources } from "@metriport/shared";
import { AppointmentWithAttendee } from "@metriport/shared/interface/external/ehr/healthie/appointment";
import { GetAppointmentsClientRequest } from "../../command/get-appointments/ehr-get-appointments";
import { createHealthieClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<AppointmentWithAttendee[]> {
  const { cxId, practiceId, fromDate, toDate } = params;
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
  const client = await createHealthieClient({ cxId, practiceId });
  const appointments = await client.getAppointments({
    cxId,
    startAppointmentDate: fromDate,
    endAppointmentDate: toDate,
  });
  return appointments;
}
