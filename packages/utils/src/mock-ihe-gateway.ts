import express from "express";
import { parseXmlString } from "@metriport/core/external/carequality/xcpd-parsing";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.text({ type: "application/soap+xml" }));

app.all("/xcpd/v1", (req, res) => {
  parseXmlString(req.body);
  res.status(200).send("OK");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
