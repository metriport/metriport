import { WriteBackLabClientRequest } from "../../../command/write-back/lab";
import { createElationHealthClient } from "../../shared";
import { getDefaultPracticeAndPhysicianIds } from "../get-default-practice-and-physician-ids";

export async function writeBackLab(params: WriteBackLabClientRequest): Promise<void> {
  const { tokenInfo, cxId, practiceId, ehrPatientId, observation } = params;
  const { elationPracticeId, elationPhysicianId } = await getDefaultPracticeAndPhysicianIds({
    practiceId,
  });
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  await client.createLab({
    cxId,
    elationPracticeId,
    elationPhysicianId,
    patientId: ehrPatientId,
    observation,
  });
}
