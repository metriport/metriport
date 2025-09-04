import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  isGroupedVitalsByDate,
  WriteBackGroupedVitalsClientRequest,
} from "../../../command/write-back/grouped-vitals";
import { createElationHealthClient } from "../../shared";
import { getDefaultPracticeAndPhysicianIds } from "../get-default-practice-and-physician-ids";

export async function writeBackGroupedVitals(
  params: WriteBackGroupedVitalsClientRequest
): Promise<void> {
  const { tokenInfo, cxId, practiceId, ehrPatientId, groupedVitals } = params;
  if (!isGroupedVitalsByDate(groupedVitals)) {
    throw new BadRequestError("Invalid grouped vitals", undefined, {
      ehr: EhrSources.elation,
      writeBackResource: "grouped-vitals",
    });
  }
  const { elationPracticeId, elationPhysicianId } = await getDefaultPracticeAndPhysicianIds({
    practiceId,
  });
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  await client.createGroupedVitals({
    cxId,
    elationPracticeId,
    elationPhysicianId,
    patientId: ehrPatientId,
    groupedVitals,
  });
}
