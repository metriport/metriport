import * as fs from "fs";
import { downloadToFile, downloadToMemory, downloadToStream } from "../file-downloader";

/**
 * - Create a temporary folder with files to download
 * - Create an HTTP server to serve the files:
 *    $ python3 -m http.server 8432
 * - Update the `url` and `extension` constants with the name of the file to download
 */
const url = "http://localhost:8432/file.png";
const extension = "png";

async function main1(fileName: string) {
  console.log(`Downloading file from: ${url} directly into the filesystem...`);
  const outputStream = fs.createWriteStream(fileName);
  await downloadToStream({
    url,
    outputStream,
  });
  console.log(`Done`);
}

async function main2(fileName: string) {
  console.log(`Downloading file from: ${url}...`);
  const buf = await downloadToMemory({
    url,
  });
  console.log(`Downloaded to buffer, storing on the filesystem...`);
  fs.writeFileSync(fileName, buf);

  console.log(`Done`);
}
async function main3(fileName: string) {
  console.log(`Downloading file from: ${url}...`);
  await downloadToFile({
    url,
    filePath: fileName,
  });
  console.log(`Done`);
}

const getFilename = (suffix: string) => `file_${suffix}.${extension}`;

main1(getFilename("from_stream"));
main2(getFilename("from_memory"));
main3(getFilename("direct"));
