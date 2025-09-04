import { Command } from "commander";
import express from "express";
import path from "path";

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

  app.get("/", (req, res) => {
    res.sendFile(path.join(HTML_DIR, "interactive.html"));
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
