import fs from "fs";
import path from "path";
import { parseMTOMResponse } from "../xca/process/mtom-parser";

describe.skip("parse MTOM file", () => {
  const mtomFilePath = path.join(__dirname, "./files/mtom.txt");
  const mtomFile = fs.readFileSync(mtomFilePath, "utf8");
  const contentType = `multipart/related; type="application/xop+xml";start="<http://tempuri.org/0>";boundary="uuid:5ef8425b-44e7-4a4c-8144-b8ddacb300f9+id=34067";start-info="application/soap+xml`;
  const mtom = parseMTOMResponse(mtomFile, contentType);
  console.log("mtom", mtom);
});
