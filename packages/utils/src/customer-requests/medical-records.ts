import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import fs from "fs";

// get xml file from this folder and bundle to html

const bundle = fs.readFileSync("test-bundle.json", "utf8");
const bundleParsed = JSON.parse(bundle);

// FHIR Bundle
// const html = bundleToHtml(bundleParsed);

// Response from FHIR Converter
const html = bundleToHtml(bundleParsed.fhirResource);

fs.writeFileSync("test.html", html);
