import * as AWS from "aws-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CodeChallenge } from ".";
import { sendToSlack } from "../../../external/slack";
import { MetriportError } from "../../../util/error/metriport-error";
import { sleep } from "../../../util/sleep";

dayjs.extend(duration);

const MAX_ATTEMPT_DURATION = dayjs.duration({ minutes: 9 });
const WAIT_BETWEEN_ATTEMPTS = dayjs.duration({ seconds: 10 });

export class CodeChallengeFromSecretManager implements CodeChallenge {
  private readonly secretManager: AWS.SecretsManager;

  constructor(
    private readonly secretArn: string,
    region: string,
    private readonly notificationUrl: string
  ) {
    this.secretManager = new AWS.SecretsManager({ region });
  }

  async getCode(): Promise<string> {
    // get code from secret manager
    const originalSecretValue = await this.getCodeFromSecretManager();
    // notify Slack
    await sendToSlack(
      {
        subject: "CW Code Challenge initiated :loading:",
        message: "Please update the secret manager at AWS console",
        emoji: ":warning:",
      },
      this.notificationUrl
    );

    const startedAt = Date.now();
    let elapsedTime = 0;
    let attempts = 0;
    do {
      attempts++;
      await sleep(WAIT_BETWEEN_ATTEMPTS.asMilliseconds());
      // get code from secret manager
      const updatedSecretValue = await this.getCodeFromSecretManager();
      // if the same, sleep and try again
      // if different, return code
      if (updatedSecretValue && updatedSecretValue !== originalSecretValue) {
        console.log(`returning this code: ${updatedSecretValue}`);
        return updatedSecretValue;
      }
      console.log(`not happy with this code, trying again...`);
      elapsedTime = Date.now() - startedAt;
    } while (elapsedTime < MAX_ATTEMPT_DURATION.asMilliseconds());
    throw new MetriportError(`Could not get code for challenge`, undefined, {
      attempts,
      elapsedMinutes: dayjs.duration(elapsedTime).asMinutes(),
    });
  }

  private async getCodeFromSecretManager(): Promise<string | undefined> {
    const appSecret = await this.secretManager
      .getSecretValue({ SecretId: this.secretArn })
      .promise();
    return appSecret.SecretString;
  }
}
