import express from "express";
import { generateXCPD } from "@metriport/core/external/carequality/iti-55-parsing";
import { generateITI38 } from "@metriport/core/external/carequality/iti-38-parsing";
import { generateITI39 } from "@metriport/core/external/carequality/iti-39-parsing";
import bodyParser from "body-parser";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

const app = express();

app.use(bodyParser.text({ type: "application/soap+xml" }));

app.post("/xcpd/v1", async (req, res) => {
  try {
    const xcpd = await generateXCPD(req.body);
    res.set("Content-Type", "application/soap+xml; charset=utf-8");
    res.send(xcpd);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.post("/iti38/v1", async (req, res) => {
  try {
    const iti38 = await generateITI38(req.body);
    res.set("Content-Type", "application/soap+xml; charset=utf-8");
    res.send(iti38);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.post("/iti39/v1", async (req, res) => {
  try {
    const hardcodedContentType =
      'multipart/related; type="application/xop+xml"; start="<soapenv>"; boundary="MIME_multipart"; start-info="application/soap+xml"';
    const iti39 = await generateITI39(req.body, hardcodedContentType);
    res.set("Content-Type", "application/soap+xml; charset=utf-8");
    res.send(iti39);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
