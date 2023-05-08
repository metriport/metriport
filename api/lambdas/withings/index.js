import axios from "axios";

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
  const withingsWhitelistIpAddresses = [
    "89.30.121.171",
    "89.30.121.172",
    "89.30.121.173",
    "89.30.121.174",
    "89.30.121.150",
    "89.30.121.143",
    "89.30.121.144",
    "89.30.121.145",
    "89.30.121.146",
    "89.30.121.140",
    "89.30.121.150",
    "89.30.121.160",
    "89.30.121.170",
  ];

  const ipAddress = req.socket.remoteAddress;

  if (withingsWhitelistIpAddresses.includes(ipAddress)) {
    return forwardCallToServer(req);
  }

  console.log("Request does not include a valid Withings IP address");
  return defaultResponse();
};

async function forwardCallToServer(req) {
  console.log(`Verified! Calling server...`);

  const resp = await api.post(apiServerURL, req.body, { headers: req.headers });

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
}
