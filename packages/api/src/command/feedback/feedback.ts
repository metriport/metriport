import { NotFoundError } from "@metriport/shared";
import { FeedbackCreate } from "../../domain/feedback";
import { FeedbackModel } from "../../models/feedback";

export async function createOrUpdateFeedback({
  id,
  cxId,
  entityId,
  data,
}: FeedbackCreate): Promise<FeedbackModel | undefined> {
  const [mr] = await FeedbackModel.upsert({
    id,
    cxId,
    entityId,
    data,
  });
  return mr;
}

export async function getFeedback({ id }: { id: string }): Promise<FeedbackModel | undefined> {
  const feedback = await FeedbackModel.findOne({ where: { id } });
  return feedback ?? undefined;
}

export async function getFeedbackOrFail({ id }: { id: string }): Promise<FeedbackModel> {
  const feedback = await getFeedback({ id });
  if (!feedback) throw new NotFoundError(`Feedback not found`);
  return feedback;
}
