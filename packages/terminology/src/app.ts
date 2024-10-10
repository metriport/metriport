import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import express from "express";
import { fhirRouter } from "./router";
import { initTermServer } from "./initTermServer";

dayjs.extend(duration);

async function main() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));

  app.route("/").get((req, res) => {
    res.status(200).send("OK");
  });

  await initTermServer();

  app.use("/fhir/R4/", fhirRouter);

  const PORT = 8080;
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  const loadBalancerTimeout = dayjs.duration({ minutes: 15 }).asMilliseconds();
  const oneSecond = dayjs.duration({ seconds: 1 }).asMilliseconds();

  const timeout = loadBalancerTimeout - oneSecond;
  server.setTimeout(timeout);

  const keepAlive = loadBalancerTimeout + oneSecond;
  server.keepAliveTimeout = keepAlive;
  server.headersTimeout = keepAlive + oneSecond;
}

main();
