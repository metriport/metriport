import axios from "axios";

/**
 * Return an instance of the AthenaHealth API client configured to access the respective
 * customer's data.
 */
export const makeAthenaHealthApi = (baseUrl: string, accessToken: string) => {
  const api = axios.create({ baseURL: baseUrl, timeout: 10000 });
  api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
  return api;
};
