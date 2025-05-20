import { BookedAppointment } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { GetAppointmentsClientRequest } from "../../lambdas/appointment/get-appointments/ehr-get-appointments";
import { createAthenaHealthClient } from "../shared";

export async function getAppointmentSubscriptionEvents(
  params: GetAppointmentsClientRequest
): Promise<BookedAppointment[]> {
  const client = await createAthenaHealthClient(params);
  const appointments = await client.getAppointmentsFromSubscription({
    cxId: params.cxId,
    ...(params.fromDate && { startProcessedDate: params.fromDate }),
    ...(params.toDate && { endProcessedDate: params.toDate }),
  });
  return appointments;
}
