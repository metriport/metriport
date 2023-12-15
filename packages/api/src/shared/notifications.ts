import {
  sendAlert as coreSendAlert,
  sendNotification as coreSendNotification,
  SlackMessage as CoreSlackMessage,
} from "@metriport/core/external/slack/index";
import { Capture } from "@metriport/core/util/capture";
import { capture as captureFromCore } from "@metriport/core/util/notifications";
import * as Sentry from "@sentry/node";

/**
 * @deprecated Use core's instead
 */
export type SlackMessage = CoreSlackMessage;
/**
 * @deprecated Use core's instead
 */
export const sendNotification = async (notif: SlackMessage | string): Promise<void> =>
  coreSendNotification(notif);
/**
 * @deprecated Use core's instead
 */
export const sendAlert = async (notif: SlackMessage | string): Promise<void> =>
  coreSendAlert(notif);

export type UserData = Pick<Sentry.User, "id" | "email">;

export type ApiCapture = Capture & {
  setUser: (user: UserData) => void;
  setExtra: (extra: Record<string, unknown>) => void;
};

/**
 * @deprecated use Core's instead
 */
export const capture: ApiCapture = captureFromCore;
