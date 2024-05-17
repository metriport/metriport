import express, { Request, Response } from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const app = express();
const port = 8999;

app.use(express.text({ type: "application/xml", limit: "50mb" }));

const execAsync = promisify(exec);

app.post("/validate", async (req: Request, res: Response) => {
  const xmlData: string = req.body;

  if (typeof xmlData !== "string" || xmlData.trim() === "") {
    return res
      .status(400)
      .send({ error: "Invalid or empty XML data. Data must be a non-empty string." });
  }

  const tempXmlPath = path.join(__dirname, "temp.xml");
  fs.writeFileSync(tempXmlPath, xmlData);

  const xsdPath: string = path.join(__dirname, "schema/normative/infrastructure/cda", "CDA.xsd");

  try {
    const command = `xmllint --schema '${xsdPath}' '${tempXmlPath}' --noout`;
    const { stderr } = await execAsync(command);

    fs.unlinkSync(tempXmlPath);

    if (stderr.includes("validates")) {
      res.send({ valid: true });
    } else {
      res.status(400).send({ valid: false, errors: stderr });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (fs.existsSync(tempXmlPath)) {
      fs.unlinkSync(tempXmlPath);
    }
    res.status(500).send({ error: parseXmllintErrors(error.message) });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

function parseXmllintErrors(errorString: string) {
  const errorLines = errorString.split("\n");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors: any[] = [];

  const errorRegex =
    /(.+):(\d+): element (.+): Schemas validity error : Element '(\{[^}]+\})(.+)', attribute '(.+)': '(.+)' is not a valid value of the (.+)\./;
  const missingChildErrorRegex =
    /(.+):(\d+): element (.+): Schemas validity error : Element '(\{[^}]+\})(.+)': (.+)/;
  const unexpectedElementErrorRegex =
    /(.+):(\d+): element (.+): Schemas validity error : Element '(\{[^}]+\})(.+)': This element is not expected. (.+)/;
  const commandFailedErrorRegex = /parser error :/;

  errorLines.forEach(line => {
    let match = line.match(errorRegex);
    if (match) {
      errors.push({
        element: match[3].trim(),
        attribute: match[6].trim(),
        value: match[7].trim(),
        error: match[8].trim(),
      });
    } else {
      match = line.match(missingChildErrorRegex) || line.match(unexpectedElementErrorRegex);
      if (match) {
        errors.push({
          element: match[3].trim(),
          error: match[6].trim(),
        });
      }
      match = line.match(commandFailedErrorRegex);
      if (match) {
        errors.push({
          error: match.input,
        });
      }
    }
  });

  return { errors };
}
