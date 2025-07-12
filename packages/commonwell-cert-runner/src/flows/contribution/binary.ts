import { stringToBase64 } from "@metriport/shared";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";

export function makeBinary({
  binaryId = nanoid(),
  contentType = "application/xml",
  contents: contentsParam,
}: { binaryId?: string; contentType?: string; contents?: string } = {}) {
  const contents = contentsParam ?? fs.readFileSync(path.join(__dirname, "ccda.xml"), "utf8");
  const encodedData = stringToBase64(contents);
  const binary = {
    resourceType: "Binary",
    id: `${binaryId}`,
    contentType,
    data: `${encodedData}`,
  };
  return binary;
}
