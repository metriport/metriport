⚠ **This document applies to the Handlebars engine. Follow [this](https://github.com/microsoft/FHIR-Converter/tree/dotliquid) link for the documentation of Liquid engine.** <br></br>

# Partial Template Concept

Partial templates are a helpful tool when creating templates in the FHIR Converter. Leveraging partial templates allows you to reference them in multiple templates in the future, preventing you from having to rewrite the same code over again. Within the FHIR converter release, there are seven types of partial templates: **Resources**, **References**, **Data Type**, **Code Systems**, **Sections**, **Utils** and **Value Set**. The following sections will describe the purpose of each category of released partial templates and give you things to consider when you’re creating your own partial templates.

## General Partial Templates

The **Data Type**, **Resources** and **References** partial templates are utilized both by the HL7 v2 Converter and C-CDA converter.

### Data Type

Data type templates are building blocks used to define the contents of a data field. In most cases, the data types in HL7 v2 or C-CDA map to FHIR attributes as part of the FHIR resource. The FHIR Converter includes a large number of data types as part of the release and new data type templates will be added as they are developed by the HL7 Community or provided via customer feedback. As you create templates, you can create your own custom data types that map data fields in your implementation to FHIR.

### Resource

Resource partial templates are used to create one specific FHIR resource in the FHIR bundle. Examples of these are patient, encounter, and condition. What you need in your resource may be message or document type specific or you may be able to use the same resource template across multiple message or document types.

While the resource template maps to a single FHIR resource type, it may pull from multiple segments in an HL7 v2 message or CDA document. For example the released patient resource for HL7 v2 pulls from PID (Patient ID) and NK1 (Next of Kin) segments to generate the resource.

Most of the resource templates will reference data type or code system partial templates. Resource templates are created by parsing the HL7 v2 elements and CDA Sections and mapping those directly to the FHIR attribute. When parsing these elements, the helper functions can be helpful to ensure that you are able to pull the exact data that you need. For more details on the helper functions, please see the helper function section of the [How-To-Guide for template creation](template-creation-how-to-guide.md) and for a full list of helper functions, see the [helper function summary](helper-functions-summary.md) page.

### Reference

Reference templates allow you to create references between two related resources. This is used to help ensure that the context of the data is carried across into the FHIR bundle. Below is an example where the reference template creates a reference between the condition found in the diagnosis (from DG1 segment) and the encounter (PV1). The reference ensures that when the condition resource is created, there is a reference to the correct encounter that the condition came from:

```json
{
    "resource":{
        "resourceType": "Encounter",
        "id":"{{ID}}",
        "diagnosis":
        [
            {
                "condition":
                {
                    "reference":"{{REF}}",
                },
            },
        ],
    },
},
```

When this template is called in the main template, you must specify the values for **ID** and **REF**. Below is the example in the ADT_A01.hbs template. DG1Instance is a parameter passed to get each condition from the encounter.

```hbs
{{>References/Encounter/diagnosis.condition.hbs ID=(generateUUID ../../PV1) REF=(generateUUID DG1Instance)}}
```

## HL7 v2 Specific Partial Template

The **Code Systems** partial template is unique to HL7 v2.

### Code System

Code system templates define mappings of common codes from HL7 v2 to FHIR bundles. An example of this is mapping “F” in HL7 v2 to “female” in a FHIR resource for gender. The FHIR Converter contains a set of starting code systems that have been defined for the released templates. You can also create your own code system templates. These templates will typically use if/else statements to map values from HL7 v2 to values in FHIR. You can see examples of this in the _Code Systems_ folder of the released templates.

## C-CDA Specific Partial Templates

The **Sections**, **Utils** and **Value Set** partial templates are unique to C-CDA.

### Sections

Section templates are used in the C-CDA to FHIR Converter. A CDA document is comprised of sections, each of which contain narrative text and some of which contain structured data elements. Examples of these sections include _Encounters_, _Immunization_, _Procedures_ and _Vital Signs_. The section templates map these sections to FHIR resources. Each CDA document template is comprised of section partial templates.

### Value Set

Value Set partial templates are used in the C-CDA to FHIR Converter. These templates map the C-CDA value sets to FHIR value sets and code systems. These are implemented based on the C-CDA and FHIR specifications. We have released a selection of Value Set partial templates, but not the full list of required value sets for C-CDA.

### Utils

Utils partial templates are used in the implementation of C-CDA to FHIR we have released. These templates provide utility functions for our implementation. For example, Utils/ResourceTypeFromSection.hbs maps a CDA section to a FHIR resource type based on CDA ID values.

## Summary

Outside of the seven types of partial templates outlined above, you are welcome to create your own types of partial templates. For more details on template creation, please see the [how-to guide](template-creation-how-to-guide.md) that gives tips on creating templates. You can also visit the [handlebars website](https://handlebarsjs.com/) for full handlebars documentation.
