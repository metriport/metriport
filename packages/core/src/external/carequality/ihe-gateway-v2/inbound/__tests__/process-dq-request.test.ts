import fs from "fs";
import path from "path";
import { processDqRequest } from "../xca/process-dq";

const request = fs.readFileSync(path.join(__dirname, "xmls/epic-iti-38-request.xml"), "utf8");

it("should process ITI-38 request", () => {
  try {
    const iti55Request = processDqRequest(request);
    expect(iti55Request).toBeDefined();
  } catch (error) {
    console.log(error);
    expect(true).toBe(false);
  }
});
