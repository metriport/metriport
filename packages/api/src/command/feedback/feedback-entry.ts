import { S3Utils } from "@metriport/core/external/aws/s3";
import { sendToSlack } from "@metriport/core/external/slack";
import { Config } from "@metriport/core/util/config";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { FeedbackEntry, FeedbackEntryCreate } from "../../domain/feedback";
import { FeedbackEntryModel } from "../../models/feedback-entry";
import { normalizeString } from "../../models/_default";
import { getFeedbackOrFail } from "./feedback";

dayjs.extend(duration);

const maxLargeColumnLength = 5_000;
const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const mrLinkDuration = dayjs.duration(1, "hour");

export type GetFeedback = { id: string };

export async function createFeedbackEntry({
  feedbackId,
  comment,
  authorName,
}: FeedbackEntryCreate): Promise<FeedbackEntry> {
  const feedback = await getFeedbackOrFail({ id: feedbackId });
  const mrLocation = feedback.data.location;
  const brief = feedback.data.content;

  const feedbackEntry = await FeedbackEntryModel.create({
    id: uuidv7(),
    feedbackId,
    comment: normalizeString(comment, maxLargeColumnLength),
    authorName: normalizeString(authorName),
  });

  const mrUrl = mrLocation
    ? s3Utils.getSignedUrl({ location: mrLocation, durationSeconds: mrLinkDuration.asSeconds() })
    : "N/A";
  sendToSlack(
    {
      subject: `Feedback received about AI Brief`,
      message: `Feedback author: ${authorName}\nOriginal MR (valid for 1h): ${mrUrl}\nAI Brief:${brief}\nComment: ${comment}`,
      emoji: ":mega:",
    },
    Config.getSlackSensitiveDataChannelUrl()
  );

  return feedbackEntry.dataValues;
}

export async function getFeedbackEntry({
  id,
}: GetFeedback): Promise<FeedbackEntryModel | undefined> {
  const entry = await FeedbackEntryModel.findOne({ where: { id } });
  return entry ?? undefined;
}

export async function getFeedbackEntryOrFail({ id }: GetFeedback): Promise<FeedbackEntryModel> {
  const entry = await getFeedbackEntry({ id });
  if (!entry) throw new NotFoundError("Feedback entry not found");
  return entry;
}
