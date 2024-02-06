# FHIR® Converter (Handlebars engine)

![Node.js CI](https://github.com/microsoft/FHIR-Converter/workflows/Node.js%20CI/badge.svg?branch=master)

FHIR® Converter is an open source project that enables the conversion of health data from legacy format to FHIR. Currently it supports HL7v2, and CCDA, to FHIR conversion.

The Converter makes use of templates that define the mappings between different data formats. The templates are written in [Handlebars](https://handlebarsjs.com/) templating language and make use of custom [helper functions](docs/helper-functions-summary.md), which make it easy to work with HL7v2 messages, and CCDA documents.

Templates for HL7v2, and CCDA, to FHIR conversion come pre-installed with the Converter. HL7v2 to FHIR templates are based on the [spreadsheet](https://docs.google.com/spreadsheets/d/1PaFYPSSq4oplTvw_4OgOn6h2Bs_CMvCAU9CqC4tPBgk/edit#gid=0) created by the HL7 [2-To-FHIR project](https://confluence.hl7.org/display/OO/2-To-FHIR+Project). If needed, you can create new, or modify existing templates by following this document, and deploy those to meet your specific conversion requirements.

FHIR converter runs as a REST web service and can be deployed on-prem or in the cloud. It takes raw data as input and converts it to FHIR bundles.

The FHIR Converter consists of the following components:

1. [Conversion APIs](docs/api-summary.md) for converting data in request-response mode
1. Pre-installed [set of templates](src/templates) for HL7v2 and CDA to FHIR conversion.
1. [Sample data](src/sample-data) for testing purpose.
1. A [Browser based editor](docs/web-ui-summary.md) to modify, create, and test templates.
1. [Template management APIs](docs/api-summary.md) to manage the templates

The FHIR Converter released to open source on Thursday March 6th, 2020 with support for HL7 v2 to FHIR conversion. On Friday June 12th, 2020, C-CDA to FHIR conversion was added to the OSS FHIR Converter.

FHIR® is the registered trademark of HL7 and is used with the permission of HL7. Use of the FHIR trademark does not constitute endorsement of this product by HL7.

## Deploying the FHIR Converter

### Deploy on-prem

Make sure that you have Node.js >=14.0 < 15.0 installed

```
git clone https://github.com/microsoft/FHIR-Converter/
cd FHIR-Converter
git checkout handlebars
npm install
npm start
```

Once this completes, you can access the UI and the service at http://localhost:8080/

## Using the FHIR Converter

HL7v2 to FHIR, and CCDA to FHIR conversion templates come pre-installed on the FHIR converter. You can test the default conversion behavior of the service either by using the [UI](docs/web-ui-summary.md), or the [API](docs/api-summary.md). In case the default templates do not meet your requirements, you can modify the templates by following [How to create templates](docs/template-creation-how-to-guide.md) document.

### Sample pipeline using FHIR converter

Visit the Microsoft health architectures github page to see a [sample](https://github.com/microsoft/health-architectures/tree/master/HL7Conversion) pipeline that leverages the FHIR Converter in an end to end scenario.

## Reference documentation

### Data conversion

- [Using conversion API](docs/convert-data-concept.md)

### Template creation and management

- [How to create templates](docs/template-creation-how-to-guide.md)
- [Partial template conceptual guide](docs/partial-template-concept.md)
- [Examples of using helper functions](docs/using-helpers-concept.md)

### Additional resources

- [Summary of available APIs](docs/api-summary.md)
- [Helper function summary](docs/helper-functions-summary.md)
- [Web UI summary](docs/web-ui-summary.md)

## Known issues

There is a known issue that the v1.0.0 converter UI gets auto-updated to v2.0.0 and the v1.0.0 templates are no longer visible in the UI. You can follow [these steps](docs/web-ui-auto-update-issue.md) to resolve this issue.

## External resources

- [Handlebars Documentation](https://handlebarsjs.com/)
- [HL7 Community 2-To-FHIR-Project](https://confluence.hl7.org/display/OO/2-To-FHIR+Project)

## Resoure Counts on Reference Insert

```
Pre FHIR Insert
Resources: {
  "AllergyIntolerance": 819,
  "Composition": 9445,
  "Condition": 16920,
  "Consent": 53,
  "Coverage": 742,
  "Device": 9207,
  "FamilyMemberHistory": 774,
  "Medication": 10376,
  "MedicationStatement": 5560,
  "Observation": 150294,
  "Organization": 20477,
  "Patient": 9445,
  "Practitioner": 37757,
  "RelatedPerson": 12240,
  "DiagnosticReport": 30754,
  "Encounter": 18582,
  "Location": 17626,
  "Procedure": 9410,
  "Immunization": 2456,
  "MedicationRequest": 4525,
  "MedicationAdministration": 5231,
  "Communication": 1525,
  "ServiceRequest": 1,
  "Goal": 547
}
Total: 374766
```

```
Post FHIR Insert
Resources:  {
	AllergyIntolerance: 752,
	Communication: 790,
	Composition: 9424,
	Condition: 13020,
	Consent: 44,
	Coverage: 556,
	Device: 3830,
	DiagnosticReport: 24773,
	Encounter: 18460,
	FamilyMemberHistory: 725,
	Goal: 45,
	Immunization: 2123,
	MedicationAdministration: 3770,
	MedicationRequest: 3398,
	MedicationStatement: 4695,
	Observation: 81321,
	Procedure: 8711,
	RelatedPerson: 269,
	ServiceRequest: 1,
	Practitioner: 7447
}
Total resources: 184154
```
