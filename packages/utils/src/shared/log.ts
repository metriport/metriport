import fs from "fs";

const errorSeparator = "----------------------------------------";

export function logNotDryRun(log = console.log) {
  // The first chars there are to set color red on the terminal
  // See: // https://stackoverflow.com/a/41407246/2099911
  log("\n\x1b[31m%s\x1b[0m\n", "---- ATTENTION - THIS IS NOT A SIMULATED RUN ----");
}

export function logErrorToFile(fileName: string, msg: string, error: Error) {
  const date = new Date().toISOString();
  fs.appendFileSync(
    fileName,
    `${errorSeparator}\n${date} - ${msg}\n${error.message}\n${error.stack}\n\n`
  );
}
