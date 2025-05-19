import { capture } from "./shared/capture";

capture.init();

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async () => {
  console.log(`This is a stub for the Surescripts SFTP integration`);
});
