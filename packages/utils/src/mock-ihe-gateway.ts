import express from "express";
import {
  parseXmlStringForPatientData,
  generateXCPD,
} from "@metriport/core/external/carequality/iti-55-parsing";
import { generateITI38 } from "@metriport/core/external/carequality/iti-38-parsing";
import { generateITI39 } from "@metriport/core/external/carequality/iti-39-parsing";
import { PatientData } from "@metriport/core/external/carequality/patient-incoming-schema";
import { isAnyPatientMatching } from "@metriport/core/external/carequality/patient-matching";
import bodyParser from "body-parser";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

const app = express();
app.use(bodyParser.text({ type: "application/soap+xml" }));

app.post("/xcpd/v1", (req, res) => {
  parseXmlStringForPatientData(req.body)
    .then((patientData: PatientData) => {
      const matchingPatient = isAnyPatientMatching(patientData);
      if (matchingPatient) {
        generateXCPD(req.body, "OK", matchingPatient)
          .then((xcpd: string) => {
            res.set("Content-Type", "application/soap+xml; charset=utf-8");
            res.send(xcpd);
          })
          .catch((err: Error) => {
            console.log("error", err);
          });
      } else {
        console.log("no patient matching");
        generateXCPD(req.body, "NF", matchingPatient)
          .then((xcpd: string) => {
            res.set("Content-Type", "application/soap+xml; charset=utf-8");
            res.send(xcpd);
          })
          .catch((err: Error) => {
            console.log("error", err);
          });
      }
    })
    .catch((err: Error) => {
      console.log("error", err);
    });
});

app.post("/iti38/v1", (req, res) => {
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

app.post("/iti39/v1", (req, res) => {
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
