import { BadRequestError, EhrSources } from "@metriport/shared";
import { BookedAppointment } from "@metriport/shared/interface/external/ehr/elation/appointment";
import { GetAppointmentsClientRequest } from "../../command/get-appointments/ehr-get-appointments";
import { createElationHealthClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<BookedAppointment[]> {
  const { cxId, practiceId, fromDate, toDate, tokenId } = params;
  if (!fromDate || !toDate) {
    throw new BadRequestError("fromDate and toDate are required", undefined, {
      method: "getAppointments",
      ehr: EhrSources.elation,
      cxId,
      practiceId,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    });
  }
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const appointments = await client.getAppointments({ cxId, fromDate, toDate });
  return appointments;
}
