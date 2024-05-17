Miminimum Required Composition

This is a combination of required from the FHIR standard perspective and also the Metriport Business
logic perspective. If its not marked with FHIR, then its required by Metriport
See FHIR spec for more info: https://www.hl7.org/fhir/R4/composition.html

```
{
        "resource": {
          "resourceType": "Composition",
          "status": "final", // FHIR
          "type": { // FHIR
            "coding": [
              {
                "code": "11506-3",
                "display": "Subsequent evaluation note",
                "system": "http://loinc.org"
              }
            ]
          },
          "dateTime": "2024-03-06T21:22:21.000Z", // FHIR
          "title": "Encounter Summary", // FHIR
          "section": [
            {
              "entry": [ // example entry resources
                {
                  "reference": "DiagnosticReport/46b19428-b5f1-43e1-b552-17c16eced743",
                  "display": "Report 1"
                },
                {
                  "reference": "Observation/5fd0c95f-e8ac-474e-9fc8-4e6a64704213",
                  "display": "Observation 1"
                }
              ]
            }
          ],
          "subject": {
            "reference": "Patient/018e157a-ffea-76c3-bc46-2759d7a6ae0f" // Your Patient
          },
          "encounter": {
            "reference": "Encounter/90170bdf-3029-49d9-ba31-48c942bf3799" // The Encounter
          },
          "author": [
            {
              "reference": "Organization/196c876b-2b43-435a-931c-e71f39b755d8" // Your Organization
            },
            {
              "reference": "Practitioner/72f1f714-222b-4155-8fc3-3feb7befa308" // Your Provider
            }
          ],
        },
      }
```

The referenced resources must be provided in the rest of the FHIR bundle. You can include as many composition bundles as you want, but the only resources that will get converted to CDA will be ones included in the section as a reference or in subject, encounter, or author.

As a minimum, a CDA is required to have the following attributes (\* denotes resources that the user has to provide):

- id
- code
- effectiveTime
- configdentialityCode
- author\*
- custodian
- recordTarget\*
- component\*

Refer to HL7 documentation for clarity: https://build.fhir.org/ig/HL7/CDA-core-sd/index.html
