import { BadRequestError, EhrSources } from "@metriport/shared";
import { BookedAppointment } from "@metriport/shared/interface/external/ehr/athenahealth/appointment";
import { GetAppointmentsClientRequest } from "../../command/get-appointments/ehr-get-appointments";
import { createAthenaHealthClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<BookedAppointment[]> {
  const { cxId, practiceId, fromDate, toDate, tokenId, departmentIds } = params;
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
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const appointments = await client.getAppointments({
    cxId,
    ...(departmentIds && { departmentIds }),
    startAppointmentDate: fromDate,
    endAppointmentDate: toDate,
  });
  return appointments;
}
