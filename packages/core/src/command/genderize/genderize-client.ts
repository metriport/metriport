import { sleep } from "@metriport/shared/common/sleep";
import { MetriportError } from "@metriport/shared";
import axios from "axios";

export type GenderLabel = "male" | "female";
export interface GenderResult {
  label: GenderLabel;
  score: number;
}

interface CogResponse {
  output: GenderResult;
}

const COG_HOST = "127.0.0.1";
const COG_PORT = "5000";
export const COG_URL = `http://${COG_HOST}:${COG_PORT}`;
const ATTEMPTS = 10;
const DELAY_MS = 20;

const client = axios.create({
  baseURL: COG_URL,
  timeout: 30000,
});

export async function classify(name: string): Promise<GenderResult> {
  let lastErr: any;
  for (let i = 0; i < ATTEMPTS; i++) {
    try{
      const { data } = await client.post<CogResponse>("/predictions", {
        input: { name },
      });

      return data.output;
    } catch (err: any){
      lastErr = err;
      await sleep(DELAY_MS);
    }
  }

  throw new MetriportError(`Cog threw an error`, lastErr, {name});
}
