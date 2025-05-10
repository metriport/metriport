import { uuidv7 } from "../../util/uuid-v7";

export type Brief = {
  id: string;
  content: string;
  link: string;
};

export function convertStringToBrief({
  aiBrief,
  dashUrl,
}: {
  aiBrief: string | undefined;
  dashUrl: string;
}): Brief | undefined {
  if (!aiBrief) return undefined;
  const feedbackId = uuidv7();
  const feedbackLink = `${dashUrl}/feedback/${feedbackId}`;
  return {
    id: feedbackId,
    content: aiBrief,
    link: feedbackLink,
  };
}
