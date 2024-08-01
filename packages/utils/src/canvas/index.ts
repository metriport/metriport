import * as dotenv from "dotenv";
dotenv.config();

import CanvasSDK from "@metriport/core/external/canvas/index";
import { createNote } from "@metriport/core/external/canvas/note";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const canvasClientSecret = getEnvVarOrFail(`CANVAS_CLIENT_SECRET`);
const canvasClientId = getEnvVarOrFail(`CANVAS_CLIENT_ID`);

async function main() {
  try {
    const canvas = await CanvasSDK.create({
      environment: "metriport-sandbox",
      clientId: canvasClientId,
      clientSecret: canvasClientSecret,
    });

    const canvasPatientId = "";
    await createNote({ canvas, canvasPatientId, patientA: false, patientB: true });
    console.log("note created");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
