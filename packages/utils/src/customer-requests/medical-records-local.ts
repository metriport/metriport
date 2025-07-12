import { bundleToHtmlNewPatient } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-new-patient";
import fs from "fs";

const bundleFilePath = "/Users/orta21/Documents/phi/test.json";

const bundle = fs.readFileSync(bundleFilePath, "utf8");
const bundleParsed = JSON.parse(bundle);

// FHIR Bundle
const html = bundleToHtmlNewPatient(bundleParsed, undefined);

// Response from FHIR Converter
// const html = bundleToHtml(bundleParsed.fhirResource, undefined, false);

fs.writeFileSync("./runs/local-summary.html", html);
