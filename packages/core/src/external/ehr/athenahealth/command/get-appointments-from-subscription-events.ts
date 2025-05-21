import { BookedAppointment } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { GetAppointmentsClientRequest } from "../../lambdas/get-appointments/ehr-get-appointments";
import { createAthenaHealthClient } from "../shared";

export async function getAppointmentsFromSubscriptionEvents(
  params: GetAppointmentsClientRequest
): Promise<BookedAppointment[]> {
  const { cxId, practiceId, environment, tokenId, fromDate, toDate } = params;
  const client = await createAthenaHealthClient({
    environment,
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const appointments = await client.getAppointmentsFromSubscription({
    cxId,
    ...(fromDate && { startProcessedDate: fromDate }),
    ...(toDate && { endProcessedDate: toDate }),
  });
  return appointments;
}
