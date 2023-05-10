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
  const withingsIPAddresses1 = await lookup("ipblock-notify.withings.net");
  const withingsIPAddresses2 = await lookup("ipblock-front.withings.net");

  const withingsWhitelistIpAddresses = [...withingsIPAddresses1, ...withingsIPAddresses2];

  const ipAddress = req.socket.remoteAddress;

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
        reject("DNS lookup failed");
      }
      resolve(stdout.split(" ").map(s => s.replace(/[^0-9.]/g, "")));
    });
  });
};

async function forwardCallToServer(req) {
  console.log(`Verified! Calling server...`);

  const resp = await api.post(apiServerURL, req.body, { headers: req.headers });

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
}
