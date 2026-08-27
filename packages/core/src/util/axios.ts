import axios, { AxiosInstance, CreateAxiosDefaults } from "axios";
import http from "http";
import https from "https";

const isLocalDevelopment = process.env["NODE_ENV"] !== "production";

export function makeAxiosInstance(config: Partial<CreateAxiosDefaults> = {}): AxiosInstance {
  const defaults: Partial<CreateAxiosDefaults> = {};
  if (isLocalDevelopment) {
    // Fix IPv4 only by default so we don't get errors on local development from Axios trying to use IPv6.
    defaults.httpAgent = new http.Agent({ family: 4 });
    defaults.httpsAgent = new https.Agent({ family: 4 });
  }
  return axios.create({ ...defaults, ...config });
}
