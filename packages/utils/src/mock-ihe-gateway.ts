import express from "express";
import {
  parseXmlStringForPatientData,
  generateXCPD,
  isAnyPatientMatching,
} from "@metriport/core/external/carequality/xcpd-parsing";
import { PatientData } from "@metriport/core/external/carequality/patient-incoming-schema";
import { xcpdTemplate } from "@metriport/core/external/carequality/xcpd-template";
import bodyParser from "body-parser";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

const app = express();
app.use(bodyParser.text({ type: "application/soap+xml" }));

app.all("/xcpd/v1", (req, res) => {
  // parseXmlString(req.body);

  // log it pretty
  parseXmlStringForPatientData(req.body)
    .then((patientData: PatientData) => {
      if (isAnyPatientMatching(patientData)) {
        generateXCPD(req.body, patientData, xcpdTemplate)
          .then((xcpd: string) => {
            res.set("Content-Type", "application/soap+xml; charset=utf-8");
            res.send(xcpd);
          })
          .catch((err: Error) => {
            console.log("error", err);
          });
      } else {
        console.log("no patient matching");
        res.status(404).send("No patient matching");
      }
    })
    .catch((err: Error) => {
      console.log("error", err);
    });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
