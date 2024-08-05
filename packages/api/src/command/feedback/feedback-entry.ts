import { sendNotification } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import { FeedbackEntry, FeedbackEntryCreate } from "../../domain/feedback";
import { FeedbackEntryModel } from "../../models/feedback-entry";
import { normalizeString } from "../../models/_default";
import { Config } from "../../shared/config";
import { getFeedbackOrFail } from "./feedback";

const maxLargeColumnLength = 5_000;

export type GetFeedback = { id: string };

export async function createFeedbackEntry({
  feedbackId,
  comment,
  authorName,
}: FeedbackEntryCreate): Promise<FeedbackEntry> {
  await getFeedbackOrFail({ id: feedbackId });

  const feedbackEntry = await FeedbackEntryModel.create({
    id: uuidv7(),
    feedbackId,
    comment: normalizeString(comment, maxLargeColumnLength),
    authorName: normalizeString(authorName),
  });

  const detailsUrl = Config.getApiUrl() + "/internal/feedback/entry/" + feedbackEntry.id;
  sendNotification({
    message: `Author: ${authorName}\nComment: ${comment.length} characters`,
    subject: `Feedback received about AI Brief - details on ${detailsUrl} (requires VPN)`,
    emoji: ":mega:",
  });

  return feedbackEntry.dataValues;
}

export async function getFeedbackEntry({
  id,
}: GetFeedback): Promise<FeedbackEntryModel | undefined> {
  const patient = await FeedbackEntryModel.findOne({
    where: { id },
  });
  return patient ?? undefined;
}

export async function getFeedbackEntryOrFail({ id }: GetFeedback): Promise<FeedbackEntryModel> {
  const entry = await getFeedbackEntry({ id });
  if (!entry) throw new NotFoundError("Feedback entry not found");
  return entry ?? undefined;
}
