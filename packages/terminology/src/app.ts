import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { fhirRouter } from "./router";
import { initSqliteFhirServer } from "./sqlite";

async function main() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  await initSqliteFhirServer();

  app.use("/fhir/R4/", fhirRouter);

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

main();