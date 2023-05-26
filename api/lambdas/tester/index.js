import axios from "axios";
const api = axios.create({ timeout: 10_000 });

// OSS API
const url = "http://Stagi-APIFa-L2I135INABM3-e3a33dd4470439f2.elb.us-east-2.amazonaws.com";

// Test lambda, to validate/test stuff on the cloud env
export const handler = async function () {
  console.log(`Running, calling ${url}...`);
  const res = await api.get(url);
  console.log(`Success! Response status: ${res.status}, body: ${JSON.stringify(res.data)}`);

  console.log(`Done`);
};
