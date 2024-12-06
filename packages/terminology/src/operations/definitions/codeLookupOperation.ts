// Licensed under Apache. See LICENSE-APACHE in the repo root for license information.
import { OperationDefinition } from "@medplum/fhirtypes";

export const codeLookupOperationDefinition: OperationDefinition = {
  resourceType: "OperationDefinition",
  id: "CodeSystem-lookup",
  meta: {
    lastUpdated: "2019-11-01T09:29:23.356+11:00",
  },
  extension: [
    {
      url: "http://hl7.org/fhir/StructureDefinition/structuredefinition-fmm",
      valueInteger: 5,
    },
    {
      url: "http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status",
      valueCode: "normative",
    },
    {
      url: "http://hl7.org/fhir/StructureDefinition/structuredefinition-normative-version",
      valueCode: "4.0.1",
    },
  ],
  url: "http://hl7.org/fhir/OperationDefinition/CodeSystem-lookup",
  version: "4.0.1",
  name: "Concept Look Up & Decomposition",
  status: "draft",
  kind: "operation",
  date: "2019-11-01T09:29:23+11:00",
  publisher: "HL7 (FHIR Project)",
  contact: [
    {
      telecom: [
        {
          system: "url",
          value: "http://hl7.org/fhir",
        },
        {
          system: "email",
          value: "fhir@lists.hl7.org",
        },
      ],
    },
  ],
  description:
    "Given a code/system, or a Coding, get additional details about the concept, including definition, status, designations, and properties. One of the products of this operation is a full decomposition of a code from a structured terminology.\n\nWhen invoking this operation, a client SHALL provide both a system and a code, either using the system+code parameters, or in the coding parameter. Other parameters are optional",
  code: "lookup",
  comment:
    "Note that the $lookup operation is more than just a code system search  - the server finds the concept, and gathers the return information from the underlying code system definitions.",
  resource: ["CodeSystem"],
  system: false,
  type: true,
  instance: false,
  parameter: [
    {
      name: "code",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "The code that is to be located. If a code is provided, a system must be provided",
      type: "code",
    },
    {
      name: "system",
      use: "in",
      min: 0,
      max: "1",
      documentation: "The system for the code that is to be located",
      type: "uri",
    },
    {
      name: "version",
      use: "in",
      min: 0,
      max: "1",
      documentation: "The version of the system, if one was provided in the source data",
      type: "string",
    },
    {
      name: "coding",
      use: "in",
      min: 0,
      max: "1",
      documentation: "A coding to look up",
      type: "Coding",
    },
    {
      name: "date",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "The date for which the information should be returned. Normally, this is the current conditions (which is the default value) but under some circumstances, systems need to acccess this information as it would have been in the past. A typical example of this would be where code selection is constrained to the set of codes that were available when the patient was treated, not when the record is being edited. Note that which date is appropriate is a matter for implementation policy.",
      type: "dateTime",
    },
    {
      name: "displayLanguage",
      use: "in",
      min: 0,
      max: "1",
      documentation: "The requested language for display (see $expand.displayLanguage)",
      type: "code",
    },
    {
      name: "property",
      use: "in",
      min: 0,
      max: "*",
      documentation:
        "A property that the client wishes to be returned in the output. If no properties are specified, the server chooses what to return. The following properties are defined for all code systems: url, name, version (code system info) and code information: display, definition, designation, parent and child, and for designations, lang.X where X is a designation language code. Some of the properties are returned explicit in named parameters (when the names match), and the rest (except for lang.X) in the property parameter group",
      type: "code",
    },
    {
      name: "name",
      use: "out",
      min: 1,
      max: "1",
      documentation: "A display name for the code system",
      type: "string",
    },
    {
      name: "version",
      use: "out",
      min: 0,
      max: "1",
      documentation: "The version that these details are based on",
      type: "string",
    },
    {
      name: "display",
      use: "out",
      min: 1,
      max: "1",
      documentation: "The preferred display for this concept",
      type: "string",
    },
    {
      name: "designation",
      use: "out",
      min: 0,
      max: "*",
      documentation: "Additional representations for this concept",
      part: [
        {
          name: "language",
          use: "out",
          min: 0,
          max: "1",
          documentation: "The language this designation is defined for",
          type: "code",
        },
        {
          name: "use",
          use: "out",
          min: 0,
          max: "1",
          documentation: "A code that details how this designation would be used",
          type: "Coding",
        },
        {
          name: "value",
          use: "out",
          min: 1,
          max: "1",
          documentation: "The text value for this designation",
          type: "string",
        },
      ],
    },
    {
      name: "property",
      use: "out",
      min: 0,
      max: "*",
      documentation:
        "One or more properties that contain additional information about the code, including status. For complex terminologies (e.g. SNOMED CT, LOINC, medications), these properties serve to decompose the code",
      part: [
        {
          name: "code",
          use: "out",
          min: 1,
          max: "1",
          documentation: "Identifies the property returned",
          type: "code",
        },
        {
          extension: [
            {
              url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
              valueUri: "code",
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
              valueUri: "Coding",
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
              valueUri: "string",
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
              valueUri: "integer",
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
              valueUri: "boolean",
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
              valueUri: "dateTime",
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
              valueUri: "decimal",
            },
          ],
          name: "value",
          use: "out",
          min: 0,
          max: "1",
          documentation: "The value of the property returned",
          type: "Element",
        },
        {
          name: "description",
          use: "out",
          min: 0,
          max: "1",
          documentation:
            "Human Readable representation of the property value (e.g. display for a code)",
          type: "string",
        },
        {
          name: "subproperty",
          use: "out",
          min: 0,
          max: "*",
          documentation:
            "Nested Properties (mainly used for SNOMED CT decomposition, for relationship Groups)",
          part: [
            {
              name: "code",
              use: "out",
              min: 1,
              max: "1",
              documentation: "Identifies the sub-property returned",
              type: "code",
            },
            {
              extension: [
                {
                  url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
                  valueUri: "code",
                },
                {
                  url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
                  valueUri: "Coding",
                },
                {
                  url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
                  valueUri: "string",
                },
                {
                  url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
                  valueUri: "integer",
                },
                {
                  url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
                  valueUri: "boolean",
                },
                {
                  url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
                  valueUri: "dateTime",
                },
                {
                  url: "http://hl7.org/fhir/StructureDefinition/operationdefinition-allowed-type",
                  valueUri: "decimal",
                },
              ],
              name: "value",
              use: "out",
              min: 1,
              max: "1",
              documentation: "The value of the sub-property returned",
              type: "Element",
            },
            {
              name: "description",
              use: "out",
              min: 0,
              max: "1",
              documentation:
                "Human Readable representation of the property value (e.g. display for a code)",
              type: "string",
            },
          ],
        },
      ],
    },
  ],
};
