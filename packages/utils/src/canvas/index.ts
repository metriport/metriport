import * as dotenv from "dotenv";
dotenv.config();

import CanvasSDK from "@metriport/core/external/canvas/index";
import { createFullNoteFromScratch } from "@metriport/core/external/canvas/note";
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

    // const appointment = await canvas.getAppointment("01910eff-0758-700e-bc2a-26a3a35e0b68");
    // console.log(JSON.stringify(appointment, null, 2));

    const canvasPatientId = "69927f85b48643e59e69d9e07d2759ef";
    await createFullNoteFromScratch({
      canvas,
      canvasPatientId,
      patientA: false,
      patientB: true,
      providerLastName: "Wilson",
    });

    // await createFullNote({ canvas, canvasPatientId, patientA: false, patientB: true });
    // console.log("note created");
  } catch (error) {
    console.log("Error:", error);
  }
}

main();
