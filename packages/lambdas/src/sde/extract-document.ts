import { capture } from "../shared/capture";

capture.init();

export const handler = capture.wrapHandler(async () => {
  console.log("Running data extraction");
});
