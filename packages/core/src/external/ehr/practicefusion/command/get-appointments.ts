import { BadRequestError } from "@metriport/shared";
import { BookedAppointment } from "@metriport/shared/interface/external/ehr/practicefusion/appointment";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { GetAppointmentsClientRequest } from "../../command/get-appointments/ehr-get-appointments";
import { createPracticeFusionClient } from "../shared";

export async function getAppointments(
  params: GetAppointmentsClientRequest
): Promise<BookedAppointment[]> {
  const { cxId, practiceId, fromDate, toDate } = params;
  if (!fromDate || !toDate) {
    throw new BadRequestError("fromDate and toDate are required", undefined, {
      method: "getAppointments",
      ehr: EhrSources.practicefusion,
      cxId,
      practiceId,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    });
  }
  const client = await createPracticeFusionClient({ cxId, practiceId });
  const result = await client.getAppointments({
    cxId,
    startDate: fromDate,
    endDate: toDate,
  });
  return result.events.flatMap(event => {
    if (!event.patientPracticeGuid || event.eventType.eventCategory !== "Appointment") {
      return [];
    }
    return [{ patientId: event.patientPracticeGuid }];
  });
}
