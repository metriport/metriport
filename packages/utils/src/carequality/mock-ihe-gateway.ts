import express from "express";
import { generateITI38 } from "@metriport/core/external/carequality/dq/dq-parsing";
import {
  generateITI39,
  generateITI39MTOM,
} from "@metriport/core/external/carequality/dr/dr-parsing";
import bodyParser from "body-parser";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

const app = express();

app.use(bodyParser.text({ type: "application/soap+xml" }));

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
    // const iti39 = await generateITI39(req.body);
    console.log("req.header", req.headers["content-type"]);

    if (
      req.headers &&
      req.headers["content-type"] &&
      req.headers["content-type"].includes("multipart/related")
    ) {
      const iti39 = await generateITI39MTOM(req.body);
      res.set(
        "Content-Type",
        'multipart/related; boundary=--MIMEBoundary782a6cafc4cf4aab9dbf291522804454; charset=UTF-8; type="application/soap+xml"'
      );
      res.send(iti39);
    } else {
      const iti39 = await generateITI39(req.body);
      res.set("Content-Type", "application/soap+xml; charset=utf-8");
      res.send(iti39);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
