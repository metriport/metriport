import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";
capture.init();

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async () => {
  log(`This is a stub for the Surescripts SFTP integration`);
});
