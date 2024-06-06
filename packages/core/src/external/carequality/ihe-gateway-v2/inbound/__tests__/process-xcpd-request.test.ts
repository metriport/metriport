import fs from "fs";
import path from "path";
import { processXcpdRequest } from "../xcpd/process-xcpd";

const request = fs.readFileSync(path.join(__dirname, "xmls/epic-iti-55-request.xml"), "utf8");

it("should process ITI-55 request", () => {
  try {
    const iti55Request = processXcpdRequest(request);
    expect(iti55Request).toBeDefined();
  } catch (error) {
    console.log(error);
    expect(true).toBe(false);
  }
});
