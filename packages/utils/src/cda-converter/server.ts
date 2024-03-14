import express from "express";
import { json } from "body-parser";
import { convertFhirBundleToCda } from "@metriport/core/fhir-to-cda/fhir-to-cda";

const app = express();
const port = 3000; // You can choose any port that suits your setup

// Middleware to parse JSON request bodies
app.use(json());

// POST endpoint to convert FHIR bundle to CDA
app.post("/medical/v1/convert-to-cda", (req, res) => {
  try {
    const fhirBundle = req.body;
    const splitBundles = convertFhirBundleToCda(fhirBundle);
    res.send(splitBundles);
  } catch (error) {
    console.error("Error converting FHIR bundle to CDA:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
