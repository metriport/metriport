import {
  introspectResponseSchema,
  IntrospectResponse,
} from "@metriport/shared/interface/external/athenahealth";
import { makeAthenaHealthApi } from "./api-factory";
import { createDataParams } from "./util";

export async function verifyAthena({
  accessToken,
  baseUrl,
}: {
  accessToken: string;
  baseUrl: string;
}): Promise<IntrospectResponse> {
  const api = makeAthenaHealthApi(baseUrl, accessToken);
  const data = {
    token_type_hint: "access_token",
    token: accessToken,
  };
  const introspectUrl = "/oauth2/v1/introspect";
  const dataParams = createDataParams(data);
  const resp = await api.post(introspectUrl, dataParams, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!resp.data) throw new Error(`No body returned from ${introspectUrl}`);
  console.log(`${introspectUrl} resp: ${JSON.stringify(resp.data)}`);
  return introspectResponseSchema.parse(resp.data);
}
