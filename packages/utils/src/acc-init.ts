import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import {
  CognitoIdentityProviderClient,
  CognitoIdentityProviderClientConfig,
  ListUsersCommand,
  ListUsersCommandInput,
} from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import
import axios from "axios";
import { uniq } from "lodash";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

/**
 * Initializes customers' accounts based on their Cognito users.
 *
 * Requires env vars as indicated at start of this function.
 * Its suggested to set those on a .env file so they are not stored on
 * your shell history.
 *
 * Created as part of #366
 */
async function main() {
  const accessKeyId = getEnvVarOrFail("ACCESS_KEY");
  const secretAccessKey = getEnvVarOrFail("SECRET_KEY");
  const userPoolId = getEnvVarOrFail("USER_POOL_ID");
  const region = getEnvVarOrFail("REGION");
  const apiAddress = getEnvVarOrFail("API_ADRESS");

  console.log(`Getting users...`);
  const users = await getUsers(accessKeyId, secretAccessKey, userPoolId, region);

  console.log(`Users from Cognito: ${users.length}`);
  console.log(JSON.stringify(users, null, 2));

  console.log(`Initializing the accoung of ${users.length} users...`);
  for (const userId of users) {
    await axios.post(`${apiAddress}/internal/init`, null, { params: { cxId: userId } });
  }
  console.log(`Done`);
}

async function getUsers(
  accessKeyId: string,
  secretAccessKey: string,
  userPoolId: string,
  region: string
): Promise<string[]> {
  const config: CognitoIdentityProviderClientConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
  const client = new CognitoIdentityProviderClient(config);
  const input: ListUsersCommandInput = {
    UserPoolId: userPoolId,
    AttributesToGet: ["email_verified"],
    Limit: Number("5"),
    Filter: 'cognito:user_status = "CONFIRMED"',
  };
  const command = new ListUsersCommand(input);

  const users: string[] = [];
  let response = await client.send(command);
  users.push(...(response.Users ?? []).flatMap(u => (u.Username ? u.Username : [])));
  while (response.PaginationToken) {
    const inputInternal = {
      ...input,
      PaginationToken: response.PaginationToken,
    };
    const commandInternal = new ListUsersCommand(inputInternal);
    response = await client.send(commandInternal);
    users.push(...(response.Users ?? []).flatMap(u => (u.Username ? u.Username : [])));
  }
  return uniq(users);
}

main();
