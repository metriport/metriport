import { BadRequestError, EhrSources } from "@metriport/shared";
import { BookedAppointment } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { GetAppointmentsClientRequest } from "../../lambdas/get-appointments/ehr-get-appointments";
import { createAthenaHealthClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<BookedAppointment[]> {
  const { cxId, practiceId, fromDate, toDate, environment, tokenId } = params;
  if (!fromDate || !toDate) {
    throw new BadRequestError("fromDate and toDate are required", undefined, {
      method: "getAppointments",
      ehr: EhrSources.athena,
      cxId,
      practiceId,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    });
  }
  const client = await createAthenaHealthClient({
    environment,
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const appointments = await client.getAppointments({
    cxId,
    startAppointmentDate: fromDate,
    endAppointmentDate: toDate,
  });
  return appointments;
}
