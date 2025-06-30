import { WriteBackLabClientRequest } from "../../../command/write-back/lab";
import { createElationHealthClient } from "../../shared";

export async function writeBackLab(params: WriteBackLabClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenId, observation } = params;
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  await client.createLab({ cxId, patientId: ehrPatientId, observation });
}
