import { APIGatewayProxyEvent } from "aws-lambda";
import axios from "axios";
import { exec } from "child_process";
import { getEnvOrFail } from "./shared/env";

const apiServerURL = getEnvOrFail("API_URL");

const api = axios.create();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildResponse = (status: number, body?: any) => ({
  statusCode: status,
  body,
});

const defaultResponse = () => buildResponse(200);

type EventWithBody = APIGatewayProxyEvent & { body: string };

export const handler = async (req: APIGatewayProxyEvent) => {
  console.log("withings request", req);

  const body = req.body;
  if (!body) {
    console.log(`No body found in request, returning default response`);
    return defaultResponse();
  }

  const withingsIPAddresses: string[][] = await Promise.all([
    lookup("ipblock-notify.withings.net"),
    lookup("ipblock-front.withings.net"),
  ]);
  const withingsWhitelistIpAddresses = withingsIPAddresses.reduce(
    (acc, val) => acc.concat(val),
    new Array<string>()
  );
  console.log(withingsWhitelistIpAddresses);
  const ipAddress = req.requestContext.identity.sourceIp;
  if (withingsWhitelistIpAddresses.includes(ipAddress)) {
    return forwardCallToServer({ ...req, body });
  }
  console.log("Request does not include a valid Withings IP address");
  return defaultResponse();
};

const lookup = async (address: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exec(`dig +short TXT ${address}`, (error: any, stdout: string, stderr: any) => {
      if (error || stderr) {
        reject(
          `DNS lookup failed. error: ${JSON.stringify(error)}, stderr: ${JSON.stringify(stderr)}`
        );
      }
      resolve(stdout.split(" ").map((s: string) => s.replace(/[^0-9.]/g, "")));
    });
  });
};

async function forwardCallToServer(req: EventWithBody) {
  const convertParams = new URLSearchParams(req.body);

  console.log(`Verified! Calling ${apiServerURL} - body: ${convertParams}`);

  const resp = await api.post(apiServerURL, convertParams, { headers: req.headers });

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
}
