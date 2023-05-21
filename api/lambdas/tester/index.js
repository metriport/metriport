import axios from "axios";
const api = axios.create();

const url =
  "http://Stagi-APIFa-L2I135INABM3-e3a33dd4470439f2.elb.us-east-2.amazonaws.com/internal/queue/push";

// Test lambda, to validate/test stuff on the cloud env
export const handler = async function () {
  console.log(`Running...`);

  console.log(`Calling POST ${url} without payload...`);
  const res = await api.post(url, {});
  console.log(`Success! Response status: ${res.status}, body: ${JSON.stringify(res.body)}`);

  console.log(`Done`);
};
