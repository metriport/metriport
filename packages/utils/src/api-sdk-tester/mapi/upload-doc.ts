import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { DocumentUploadPayload, MetriportMedicalApi } from "@metriport/api-sdk";
import express from "express";
import multer from "multer";
import open from "open";
import { getEnvVarOrFail } from "../../shared/env";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const patientId = getEnvVarOrFail("PATIENT_ID");

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function main() {
  const app = express();
  const port = 3010;
  const upload = multer();

  app.get("/", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <body>
          <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="file" accept=".xml">
            <button type="submit">Upload Document</button>
          </form>
        </body>
      </html>
    `);
  });

  app.post("/upload", upload.single("file"), async (req, res) => {
    if (req.file) {
      console.log(`Uploaded file of size: ${req.file.size}`);

      const organizationName = "Some organization name";
      const practitionerName = "John Snow";
      const description = "Some brief file description";

      const payload: DocumentUploadPayload = {
        fileMetadata: req.file,
        fileContents: req.file.buffer.toString("base64"),
      };

      const resp = await metriportAPI.uploadDocument(
        patientId,
        payload,
        organizationName,
        practitionerName,
        description
      );

      console.log("MAPI CLIENT RESPONSE:\n", resp);

      res.send("File uploaded and logged.");
    } else {
      console.log("Try again!");
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);

    open(`http://localhost:${port}`);
  });
}

main();
