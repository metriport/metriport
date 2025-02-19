import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import fs from "fs";

const bundleFilePath = "";

const bundle = fs.readFileSync(bundleFilePath, "utf8");
const bundleParsed = JSON.parse(bundle);

// FHIR Bundle
const html = bundleToHtml(bundleParsed, undefined, false);

// Response from FHIR Converter
// const html = bundleToHtml(bundleParsed.fhirResource, undefined, false);

fs.writeFileSync("./runs/local-summary.html", html);
