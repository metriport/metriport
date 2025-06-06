import { BookedAppointment } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { GetAppointmentsClientRequest } from "../../command/get-appointments/ehr-get-appointments";
import { createAthenaHealthClient } from "../shared";

export async function getAppointmentsFromSubscriptionEvents(
  params: GetAppointmentsClientRequest
): Promise<BookedAppointment[]> {
  const { cxId, practiceId, tokenId, fromDate, toDate, departmentIds } = params;
  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const appointments = await client.getAppointmentsFromSubscription({
    cxId,
    ...(departmentIds && { departmentIds }),
    ...(fromDate && { startProcessedDate: fromDate }),
    ...(toDate && { endProcessedDate: toDate }),
  });
  return appointments;
}
