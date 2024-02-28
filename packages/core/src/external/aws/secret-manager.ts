import * as AWS from "aws-sdk";

export function makeSecretManagerClient(region: string) {
  return new AWS.SecretsManager({ region });
}

export async function getCodeFromSecretManager(
  secretArn: string,
  region: string
): Promise<string | undefined> {
  const secretManager = makeSecretManagerClient(region);
  const appSecret = await secretManager.getSecretValue({ SecretId: secretArn }).promise();

  return appSecret.SecretString;
}
