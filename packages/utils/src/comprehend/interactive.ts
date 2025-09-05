import { Command } from "commander";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { inferMedications } from "@metriport/core/external/comprehend/rxnorm/fhir-converter";

/**
 * Interactive tool to test the Comprehend API.
 *
 * npm run comprehend -- interactive
 */
const command = new Command();
command.name("interactive");
command.option("--port <port>", "Port to run the server on", "3000");
command.description("Interactive tool to test the Comprehend API.");
command.action(runInteractive);

// Path linking requires this to be run as `npm run comprehend -- interactive`
const HTML_DIR = path.join(process.cwd(), "src/comprehend/html");

async function runInteractive({ port = 3000 }: { port?: number } = {}) {
  const app = express();
  app.use(cors());

  app.get("/", (req, res) => {
    res.sendFile(path.join(HTML_DIR, "interactive.html"));
  });

  app.use(bodyParser.json());
  app.post("/analyze", async (req, res) => {
    const { text } = req.body;
    console.log(req.body, text);
    const response = await inferMedications(text, { confidenceThreshold: 0.5 });
    res.json(response);
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default command;
