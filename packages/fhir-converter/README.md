# FHIR Converter

Converts health data to/from different formats. Currently it supports CCDA to FHIR conversion.

The converter makes use of templates that define the mappings between different data formats. The templates are written in [Handlebars](https://handlebarsjs.com/) templating language and make use of custom helper functions (`/lib/handlebars-converter/handlebars-helpers.js`), which make it easy to work with CCDA documents.

## Running the FHIR Converter

```
docker-compose up --build
```

Once this completes, you can access the service at http://localhost:8777/

## APIs

### POST /api/reloadTemplates

Send a `POST` request to this route to be able to hot reload template changes without needing to restart the server.

### POST /api/convert/ccda/ccd.hbs

Send a `POST` request to this route to convert a C-CDA document specified in the body to a a FHIR R4 Bundle of type batch with the entry containing an array of FHIR R4 Resources being the outcome of the conversion.

#### Body

A valid C-CDA (R2.1) XML document.

```
<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
    <!-- contents -->
</ClinicalDocument>

```

You can use [this example C-CDA](https://github.com/HL7/CDA-ccda-2.1/blob/master/examples/C-CDA_R2-1_CCD.xml) from HL7 for testing purposes.

#### Query Params

`patientId`: Your internal identifier for the patient that the provided C-CDA document corresponds to. This will be used to populated the patient-related references in the returned FHIR Bundle.
