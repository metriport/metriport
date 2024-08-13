import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { fhirRouter } from "./router";
import { initTermServer } from "./sqlite";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

async function main() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  await initTermServer();

  app.use("/fhir/R4/", fhirRouter);

  app
    .route("/")
    .get((req, res) => {
      res.status(200).send("OK");
    })
    .post((req, res) => {
      res.status(200).send("Ok");
    });

  const PORT = 3000;
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  const loadbalancerTimeout = dayjs.duration({ minutes: 15 }).asMilliseconds();
  const oneSecond = dayjs.duration({ seconds: 1 }).asMilliseconds();

  const timeout = loadbalancerTimeout - oneSecond;
  server.setTimeout(timeout);

  const keepalive = loadbalancerTimeout + oneSecond;
  server.keepAliveTimeout = keepalive;
  server.headersTimeout = keepalive + oneSecond;
}

main();
