import fs from "fs";
import path from "path";
import { processDRResponse } from "../dr/process-dr-response";
import { outboundDRRequest } from "./constants";

describe("processDRResponse", () => {
  it("should process the successful DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "dr.xml"), "utf8");
    processDRResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDRRequest,
      gateway: outboundDRRequest.gateway,
    });
  });
});
