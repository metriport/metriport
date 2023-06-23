import axios from "axios";
const { exec } = require("child_process");

const getEnvOrFail = name => {
  const value = process.env[name];
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
};
const api = axios.create();
const apiServerURL = getEnvOrFail("API_URL");

const buildResponse = (status, body) => ({
  statusCode: status,
  body,
});

const defaultResponse = () => buildResponse(200);

exports.handler = async req => {
  console.log("withings request", req);
  const withingsIPAddresses = await Promise.all([
    lookup("ipblock-notify.withings.net"),
    lookup("ipblock-front.withings.net"),
  ]);
  const withingsWhitelistIpAddresses = withingsIPAddresses.reduce(
    (acc, val) => acc.concat(val),
    []
  );
  console.log(withingsWhitelistIpAddresses);
  const ipAddress = req.requestContext.identity.sourceIp;
  if (withingsWhitelistIpAddresses.includes(ipAddress)) {
    return forwardCallToServer(req);
  }
  console.log("Request does not include a valid Withings IP address");
  return defaultResponse();
};

const lookup = async address => {
  return new Promise((resolve, reject) => {
    exec(`dig +short TXT ${address}`, (error, stdout, stderr) => {
      if (error || stderr) {
        reject(
          `DNS lookup failed. error: ${JSON.stringify(error, null, 2)}, stderr: ${JSON.stringify(
            stderr,
            null,
            2
          )}`
        );
      }
      resolve(stdout.split(" ").map(s => s.replace(/[^0-9.]/g, "")));
    });
  });
};

async function forwardCallToServer(req) {
  const convertParams = new URLSearchParams(req.body);

  console.log(`Verified! Calling ${apiServerURL} - body: ${convertParams}`);

  const resp = await api.post(apiServerURL, convertParams, { headers: req.headers });

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
}
