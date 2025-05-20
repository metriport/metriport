import { BadRequestError } from "@metriport/shared";
import { BookedAppointment } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { GetAppointmentsClientRequest } from "../../lambdas/appointment/get-appointments/ehr-get-appointments";
import { createAthenaHealthClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<BookedAppointment[]> {
  if (!params.fromDate || !params.toDate) {
    throw new BadRequestError("fromDate and toDate are required");
  }
  const client = await createAthenaHealthClient(params);
  const appointments = await client.getAppointments({
    cxId: params.cxId,
    startAppointmentDate: params.fromDate,
    endAppointmentDate: params.toDate,
  });
  return appointments;
}
