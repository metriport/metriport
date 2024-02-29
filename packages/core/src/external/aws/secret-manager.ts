import * as AWS from "aws-sdk";
import { MetriportError } from "../../util/error/metriport-error";

export function makeSecretManagerClient(region: string) {
  return new AWS.SecretsManager({ region });
}

export async function getSecretValue(
  secretArn: string,
  region: string
): Promise<string | undefined> {
  const secretManager = makeSecretManagerClient(region);
  const appSecret = await secretManager.getSecretValue({ SecretId: secretArn }).promise();

  return appSecret.SecretString;
}

export async function getSecretValueOrFail(secretArn: string, region: string): Promise<string> {
  const secret = await getSecretValue(secretArn, region);
  if (!secret) {
    throw new MetriportError(`Secret not found `, undefined, { secretArn });
  }

  return secret;
}
