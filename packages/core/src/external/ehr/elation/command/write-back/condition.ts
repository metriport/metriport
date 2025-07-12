import { WriteBackConditionClientRequest } from "../../../command/write-back/condition";
import { createElationHealthClient } from "../../shared";

export async function writeBackCondition(params: WriteBackConditionClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenId, condition } = params;
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  await client.createProblem({ cxId, patientId: ehrPatientId, condition, isAutoWriteBack: true });
}
