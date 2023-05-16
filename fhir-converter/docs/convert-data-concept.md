⚠ **This document applies to the Handlebars engine. Follow [this](https://github.com/microsoft/FHIR-Converter/tree/dotliquid) link for the documentation of Liquid engine.** <br></br>

# FHIR Bundle Conversion

The power of the FHIR Converter lies in its ability to convert data near real-time. Once you have modified the templates to meet your needs, you can call the API as part of your workflow. In the sections below we have an overview of the API and the output you get from the conversion.

## APIs

To convert your data leveraging the API, there are two different POST calls you can make depending on how you want to call your template. You can either convert by passing the entire template's content or you can call a template from storage by name.

| Function | Syntax                     | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST     | /api/convert/{srcDataType} | Takes data, and temporary templates as input and outputs FHIR data after applying the templates on the data. The entry-point template is passed base64-encoded in templateBase64 parameter, whereas other overriding templates are passed in the templatesOverrideBase64 parameter. templatesOverrideBase64 is a base64-encoded json object containing map between the template name and the template content. You can also set `unusedSegments` and `invalidAccess` parameters in the query string to fetch UI-related segments. |
| POST     | /api/convert/{template}    | Takes data and converts to FHIR using the {template} that is stored on the server. You can also set `unusedSegments` and `invalidAccess` parameters in the query string to fetch UI-related segments.                                                                                                                                                                                                                                                                                                                             |

### Examples

1. `/api/convert/hl7v2/ADT_A01.hbs`

   - Convert given source data(inside post body) with _HL7V2_ type and _ADT_A01.hbs_ template, the response will only contain a _fhirResource_ property.

2. `/api/convert/hl7v2/ADT_A01.hbs?unusedSegments=true`

   - Convert given source data(inside post body) with _HL7V2_ type and _ADT_A01.hbs_ template, the response will contain both _fhirResource_ and _unusedSegments_ properties.

3. `/api/convert/hl7v2/ADT_A01.hbs?invalidAccess=true`

   - Convert given source data(inside post body) with _HL7V2_ type and _ADT_A01.hbs_ template, the response will contain both _fhirResource_ and _invalidAccess_ properties.

4. `/api/convert/hl7v2/ADT_A01.hbs?unusedSegments=true&invalidAccess=true`
   - Convert given source data(inside post body) with _HL7V2_ type and _ADT_A01.hbs_ template, the response will contain all the _fhirResource_, _unusedSegments_ and _invalidAccess_ properties.

## HL7 v2 Conversion output

Each time an HL7 v2 message is converted using the APIs, there are three pieces of information returned:

| Section            | Details                                                                                                                                                                                                                                              | Use Case                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **fhirResource**   | The FHIR bundle for the converted HL7 v2 message                                                                                                                                                                                                     | The fhirResource is the FHIR bundle that you can do further manipulation on or persist directly in a FHIR server                                                                                                                                                                 |
| **unusedSegments** | **Returns only when there is a `unusedSegments=true` parameter in query string**. A list of segments that the template didn’t look at that were present in the message. In the Web UI, these are the segments that were underlined in red dots (...) | You can use the details returned in this section to see if there were any required segments that weren't processed. In this way, you can ensure that you don't store a FHIR bundle that is missing key information from the HL7 v2 message                                       |
| **invalidAccess**  | **Returns only when there is a `invalidAccess=true` parameter in query string**. A list of segments the template tried to access that didn’t exist in the incoming HL7 v2 message                                                                    | The invalidAccess section allows you to do post-processing on the FHIR bundle to ensure that the incoming HL7 v2 messages that was processed didn't have any major issues. For example, you may want to reject or investigate any message that is missing the Patient Identifier |

### Examples

Below is an example of how this data is returned

### Sample message and template

For the example, we will use the simple message and template below:

#### Message

```plaintext
MSH|^~\&|AccMgr
ZA1|1||10006579^^^1^MRN^1
```

#### Template

```hbs
{ "resourceType": "Bundle", "entry": [
{{#with (getFirstSegments msg.v2 "MSH" "ZA1")}}
  { "field1" : "{{ZA1-1}}", "field2" : "{{ZA1-2}}", "field3A" : "{{ZA1-3-4}}", "field3B" : "{{ZA1-3-5}}",
  "field4" : "{{ZA1-4}}", }
{{/with}}
] }
```

### Example conversion response

Below is the output you get from the message and template. It includes the three pieces of data.

```JSON
{
    "fhirResource": {
        "resourceType": "Bundle",
        "entry": [
            {
                "field1": "1",
                "field3A": "1",
                "field3B": "MRN"
            }
        ]
    },
    "unusedSegments": [
        {
            "type": "MSH",
            "line": 0,
            "field": [
                {
                    "index": 2,
                    "component": [
                        {
                            "index": 0,
                            "value": "AccMgr"
                        }
                    ]
                }
            ]
        },
        {
            "type": "ZA1",
            "line": 1,
            "field": [
                {
                    "index": 3,
                    "component": [
                        {
                            "index": 0,
                            "value": "10006579"
                        },
                        {
                            "index": 1,
                            "value": ""
                        },
                        {
                            "index": 2,
                            "value": ""
                        },
                        {
                            "index": 5,
                            "value": "1"
                        }
                    ]
                }
            ]
        }
    ],
    "invalidAccess": [
        {
            "type": "ZA1",
            "line": 1,
            "field": [
                {
                    "index": 4
                }
            ]
        }
    ]
}
```

## C-CDA Conversion output

Each time a CDA document is converted using the APIs, there is one piece of information returned:

| Section          | Details                                        | Use Case                                                                                                         |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **fhirResource** | The FHIR bundle for the converted CDA document | The fhirResource is the FHIR bundle that you can do further manipulation on or persist directly in a FHIR server |
