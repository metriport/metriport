/**
 * WARNING: This server setup is intended for **internal use only**.
 *
 * This file contains a minimal Express server configuration that is not hardened
 * or optimized for external-facing requests (e.g., from customers or third-party applications).
 *
 * If you plan to use this server for public access, please ensure that:
 * 1. The following are implemented:
 *    - Robust error handling
 *    - Authentication
 *    - Rate limiting (?)
 * 2. Performance optimizations and production best practices are applied.
 *
 * As it stands, this server should only be used for internal communication between services.
 */

import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import express from "express";
import { fhirRouter } from "./router";
import { initTermServer } from "./init-term-server";

dayjs.extend(duration);

async function main() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));

  app.route("/").get((req, res) => {
    res.status(200).send("OK");
  });

  await initTermServer();

  app.use("/terminology/", fhirRouter);

  const PORT = process.env.PORT || 8080;

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
