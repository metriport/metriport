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
  } catch (err) {
    console.log("error", err);
    res.status(404).send("Invalid XML");
  }
});

app.post("/iti38/v1", async (req, res) => {
  try {
    const iti38 = await generateITI38(req.body);
    res.set("Content-Type", "application/soap+xml; charset=utf-8");
    res.send(iti38);
  } catch (err) {
    console.log("error", err);
    res.status(404).send("No patient matching");
  }
});

app.post("/iti39/v1", async (req, res) => {
  try {
    const iti39 = await generateITI39(req.body);
    res.set("Content-Type", "application/soap+xml; charset=utf-8");
    res.send(iti39);
  } catch (err) {
    console.log("error", err);
    res.status(404).send("No patient matching");
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
