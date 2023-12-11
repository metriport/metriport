import express from "express";
import {
  parseXmlStringForPatientData,
  generateXCPD,
  isAnyPatientMatching,
} from "@metriport/core/external/carequality/iti-55-parsing";
import { generateITI38 } from "@metriport/core/external/carequality/iti-38-parsing";
import { generateITI39 } from "@metriport/core/external/carequality/iti-39-parsing";
import { PatientData } from "@metriport/core/external/carequality/patient-incoming-schema";
import bodyParser from "body-parser";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

const app = express();
app.use(bodyParser.text({ type: "application/soap+xml" }));

app.all("/xcpd/v1", (req, res) => {
  // parseXmlString(req.body);

  // log it pretty
  parseXmlStringForPatientData(req.body)
    .then((patientData: PatientData) => {
      const matchingPatient = isAnyPatientMatching(patientData);
      if (matchingPatient) {
        generateXCPD(req.body, matchingPatient)
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

app.all("/iti38/v1", (req, res) => {
  generateITI38(req.body)
    .then((iti38: string) => {
      res.set("Content-Type", "application/soap+xml; charset=utf-8");
      res.send(iti38);
    })
    .catch((err: Error) => {
      console.log("error", err);
      res.status(404).send("No patient matching");
    });
});

app.all("/iti39/v1", (req, res) => {
  generateITI39(req.body)
    .then((iti38: string) => {
      res.set("Content-Type", "application/soap+xml; charset=utf-8");
      res.send(iti38);
    })
    .catch((err: Error) => {
      console.log("error", err);
      res.status(404).send("No patient matching");
    });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
