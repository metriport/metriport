import express from "express";
import {
  parseXmlStringForRootExtensionSignature,
  generateTimeStrings,
  parseXmlStringForPatientData,
  fillTemplate,
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
      parseXmlStringForRootExtensionSignature(req.body)
        .then(([root, extension, signature]: [string, string, string]) => {
          const { createdAt, expiresAt, creationTime } = generateTimeStrings();
          const xcpd = fillTemplate(
            xcpdTemplate,
            createdAt,
            expiresAt,
            creationTime,
            root,
            extension,
            signature,
            patientData
          );
          // retrun xcpd
          res.set("Content-Type", "application/soap+xml; charset=utf-8");
          res.send(xcpd);
        })
        .catch((err: Error) => {
          console.log("error", err);
        });
    })
    .catch((err: Error) => {
      console.log("error", err);
    });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
