⚠ **This document applies to the Handlebars engine. Follow [this](https://github.com/microsoft/FHIR-Converter/tree/dotliquid) link for the documentation of Liquid engine.** <br></br>

# Using helpers

Helper functions are a useful tool when creating templates. In the following sections, we have given some example of how to use the included helper functions for the FHIR Converter. You can see the full list of included helper functions [here](helper-functions-summary.md).

### Basic Operators

As part of the implementation, we have included basic operators as helper functions so that you can pull in the data you need. This includes things such as equal, not equal, less than, etc.

### Creating a unique ID

As part of creating a FHIR resource, you will want to create a unique ID for the resource. To enable this, you can use the generateUUID helper which will generate a unique GUID for the resource.

Here is an example for creating a unique GUID for an HL7 v2 message:

```hbs
{
    "resourceType": "Bundle",
    "type": "transaction",
    "entry": [
        {{#with (getFirstSegments msg.v2 'PID' 'PD1' 'PV1')}}
            {{>Resources/ADT_A01/Patient.hbs PID=PID PD1=PD1 NK1=NK1 ID=(generateUUID PID)}},
```

Here is an example for creating a unique GUID for a CDA document:

```hbs
{
    "resourceType": "Bundle",
    "type": "batch",
    "entry": [
       {{#with msg.ClinicalDocument.recordTarget.patientRole}}
            {{>Resources/Patient.hbs patientRole=this ID=(generateUUID (toJsonString this))}},

```

### Force Error

In some scenarios, you may want to return an error instead of the FHIR bundle if some condition isn’t met. For example, if an HL7 v2 message comes across without the PID segment, the translation to FHIR could give an error that the HL7 v2 message is missing the PID segment. Without forcing an error, the message would translate with an empty patient resource.

To force the error instead of having the template run, you can use the assert helper function. An example of how this would look in the template is:

```hbs
{
    "resourceType": "Bundle",
    "type": "transaction",
    "entry": [
        {{#with (getFirstSegments msg.v2 'PID' 'PD1' 'PV1')}}
              {{assert PID 'HL7 v2 message is missing the PID segment’}}
```

The output on the right-hand side would return {BadRequest: Unable to create result: HL7 v2 message is missing the PID segment} in any case that the PID segment is missing from the original HL7 v2 message.

### Formatting Data

Data in HL7 v2 messages and CDA documents may not provide the correct format for the FHIR resource. There are several helper functions available to help format things like social security number and dates to meet the FHIR specification.

In a clinical document, a birth date may be stored in the format of 20000101. Using the helper function addHyphensDate you can get it into the format 2000-01-01 which is required by FHIR. In an HL7 v2 template, you would write this as "birthDate":"{{addHyphensDate PID-7}}" if birthday is stored in PID-7. In a CDA document, you would write this as "birthDate":"{{addHyphensDate patientRole.patient.birthTime.value}}". The output in the FHIR bundle in both cases would be "birthDate": "2000-01-01".

### Mathematical Functions

We have included mathematical helper functions so you can do basic math. Some of these functions are addition, subtraction, a random number generator and maximum/minimum finders.

## Using helpers for HL7v2 message conversion

### Getting Segments

A common need when translating HL7 v2 messages into FHIR will be to get a specific segment and parse over that segment. It may be that you want only the first time a segment shows up or to be able to loop over all instances of a segment type (e.g. DG1).

Below is an example using two of these helper functions. First, the template leverages getFirstSegment to get the first PID, PD1, and PV1 from the message. From there, we want to remain in the context of the patient and encounter that we pulled from above and pull all the associated DG1 segments. This is accomplished using getSegmentLists.

```hbs
{
    "resourceType": "Bundle",
    "type": "transaction",
    "entry": [
        {{#with (getFirstSegments msg.v2 'PID' 'PD1' 'PV1')}}
            {{>Resources/ADT_A01/Patient.hbs PID=PID PD1=PD1 NK1=NK1 ID=(generateUUID PID)}},
            {{>Resources/ADT_A01/Encounter.hbs PV1=PV1 ID=(generateUUID PV1)}},
            {{>References/Encounter/subject.hbs ID=(generateUUID PV1) REF=(generateUUID PID)}},

            {{#with (getSegmentLists ../msg.v2 'DG1')}}
                {{#each DG1 as |DG1Instance|}}
                    {{>Resources/ADT_A01/Condition.hbs DG1=DG1Instance ID=(generateUUID DG1Instance)}},
                    {{>References/Condition/subject.hbs ID=(generateUUID DG1Instance) REF=(generateUUID ../../PID)}},
                    {{>References/Encounter/diagnosis.condition.hbs ID=(generateUUID ../../PV1) REF=(generateUUID DG1Instance)}},
                {{/each}}
            {{/with}}
        {{/with}}
    ]
}
```

### Manipulating HL7 v2 data for FHIR bundle

There are scenarios where you need to parse or combine elements from the HL7 v2 message to get the right attribute for your FHIR bundle. We have included several array and string functions to help you pull data and return it in the way you need.

For example, if you get a patient location from PV1 3-2 in an HL7 v2 message as Cherry123 where Cherry corresponds to the building and 123 corresponds to the room, you may want to store both building and room separately in your FHIR resource.

Here is a sample message for this example:

```plaintext
MSH|^~\&|SomeSystem||TransformationAgent||201410060931||ORM^O01|MSGID20060307110114|P|2.3
PID|1||10006579^^^1^MRN^1||DUCK^DONALD^D||19241010|M||1|111 DUCK ST^^FOWL^CA^999990000^^M|1|8885551212|8885551212|1|2||40007716^^^AccMgr^VN^1|123121234|||||||||||NO
PV1|1|I|PREOP^Cherry123^1^1^^^S|3|||37^DISNEY^WALT^^^^^^AccMgr^^^^CI|||01||||1|||37^DISNEY^WALT^^^^^^AccMgr^^^^CI|2|40007716^^^AccMgr^VN|4|||||||||||||||||||1||G|||20050110045253||||||
ORC|NW|88502218|82503246||NW||||201410060929|^MOUSE^MINNIE^A^^^RN||
OBR|1|88502218|82503246|24317-0^Hemogram and platelet count, automated^LN||201410060644||||^COLLECT^JOHN|P|||||^URO^^^^DR||||||||HM|O|||||||
```

To get location, room, and building, you could use the following DataType template:

```hbs
"Location": [ "{{PV1-3-2}}" ], "Room": [ "{{replace PV1-3-2 "[A-Za-z]+" ""}}" ], "Building": [ "{{replace
  PV1-3-2
  "\d+"
  ""
}}" ],
```

## Using helpers for C-CDA document conversion

### Getting Sections

A common need when translating CDA documents into FHIR will be to get a specific section and parse over that section. It may be that you want to return the first time a CDA section shows up by template ID, and then iterate over each entry underneath that section.

Below is an example of using helper functions to create Condition Resources and References in the FHIR Bundle. The helper function **getFirstCdaSectionsByTemplateId** is used to get the first time a CDA section shows up. Then, **toArray** is used to iterate over each entry and then each observation.

```hbs
{{#with (getFirstCdaSectionsByTemplateId msg '2.16.840.1.113883.10.20.22.2.5.1')}}
    {{#each (toArray 2_16_840_1_113883_10_20_22_2_5_1.entry)}}
        {{#each (toArray this.act.entryRelationship) as |condEntry|}}
            {{>Resources/Condition.hbs conditionEntry=condEntry.observation ID=(generateUUID (toJsonString condEntry.observation))}},
            {{>References/Condition/subject.hbs ID=(generateUUID (toJsonString condEntry.observation)) REF=(concat 'Patient/' (generateUUID (toJsonString ../../../msg.ClinicalDocument.recordTarget.patientRole)))}},
        {{/each}}
    {{/each}}
{{/with}}
```
