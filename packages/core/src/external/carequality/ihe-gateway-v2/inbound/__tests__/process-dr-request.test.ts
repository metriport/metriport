import fs from "fs";
import path from "path";
import { processDrRequest } from "../xca/process-dr";

const request = fs.readFileSync(path.join(__dirname, "xmls/epic-iti-39-request.xml"), "utf8");

it("should process ITI-39 request", () => {
  try {
    const iti39Request = processDrRequest(request);
    expect(iti39Request).toBeDefined();
  } catch (error) {
    console.log(error);
    expect(true).toBe(false);
  }
});
