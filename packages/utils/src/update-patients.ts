import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { sleep } from "@metriport/shared";
import axios from "axios";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);
const SLEEP_TIME_BETWEEN_CX = dayjs.duration({ seconds: 1 });

const baseUrl = getEnvVarOrFail("API_URL"); // should use load balancer URL
const cxIds = [""];

async function main() {
  const url = baseUrl + "/internal/patient/trigger-update";
  for (const cxId of cxIds) {
    await axios.post(url, {}, { params: { cxId } });
    await sleep(SLEEP_TIME_BETWEEN_CX.asMilliseconds());
  }
}

main();
