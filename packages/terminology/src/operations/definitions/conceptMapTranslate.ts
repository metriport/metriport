// Licensed under Apache. See LICENSE-APACHE in the repo root for license information.
import { OperationDefinition } from "@medplum/fhirtypes";

export const conceptMapTranslateOperationDefinition: OperationDefinition = {
  resourceType: "OperationDefinition",
  id: "ConceptMap-translate",
  meta: {
    lastUpdated: "2019-11-01T09:29:23.356+11:00",
  },
  text: {
    status: "generated",
    div: '<div xmlns="http://www.w3.org/1999/xhtml"><h2>Concept Translation</h2><p>OPERATION: Concept Translation</p><p>The official URL for this operation definition is: </p><pre>http://hl7.org/fhir/OperationDefinition/ConceptMap-translate</pre><div><p>Translate a code from one value set to another, based on the existing value set and concept maps resources, and/or other additional knowledge available to the server.</p>\n<p>One (and only one) of the in parameters (code, coding, codeableConcept) must be provided, to identify the code that is to be translated.</p>\n<p>The operation returns a set of parameters including a \'result\' for whether there is an acceptable match, and a list of possible matches. Note that the list of matches may include notes of codes for which mapping is specifically excluded, so implementers have to check the match.equivalence for each match</p>\n</div><p>URL: [base]/ConceptMap/$translate</p><p>URL: [base]/ConceptMap/[id]/$translate</p><p>Parameters</p><table class="grid"><tr><td><b>Use</b></td><td><b>Name</b></td><td><b>Cardinality</b></td><td><b>Type</b></td><td><b>Binding</b></td><td><b>Documentation</b></td></tr><tr><td>IN</td><td>url</td><td>0..1</td><td><a href="datatypes.html#uri">uri</a></td><td/><td><div><p>A canonical URL for a concept map. The server must know the concept map (e.g. it is defined explicitly in the server\'s concept maps, or it is defined implicitly by some code system known to the server.</p>\n</div></td></tr><tr><td>IN</td><td>conceptMap</td><td>0..1</td><td><a href="conceptmap.html">ConceptMap</a></td><td/><td><div><p>The concept map is provided directly as part of the request. Servers may choose not to accept concept maps in this fashion.</p>\n</div></td></tr><tr><td>IN</td><td>conceptMapVersion</td><td>0..1</td><td><a href="datatypes.html#string">string</a></td><td/><td><div><p>The identifier that is used to identify a specific version of the concept map to be used for the translation. This is an arbitrary value managed by the concept map author and is not expected to be globally unique. For example, it might be a timestamp (e.g. yyyymmdd) if a managed version is not available.</p>\n</div></td></tr><tr><td>IN</td><td>code</td><td>0..1</td><td><a href="datatypes.html#code">code</a></td><td/><td><div><p>The code that is to be translated. If a code is provided, a system must be provided</p>\n</div></td></tr><tr><td>IN</td><td>system</td><td>0..1</td><td><a href="datatypes.html#uri">uri</a></td><td/><td><div><p>The system for the code that is to be translated</p>\n</div></td></tr><tr><td>IN</td><td>version</td><td>0..1</td><td><a href="datatypes.html#string">string</a></td><td/><td><div><p>The version of the system, if one was provided in the source data</p>\n</div></td></tr><tr><td>IN</td><td>source</td><td>0..1</td><td><a href="datatypes.html#uri">uri</a></td><td/><td><div><p>Identifies the value set used when the concept (system/code pair) was chosen. May be a logical id, or an absolute or relative location. The source value set is an optional parameter because in some cases, the client cannot know what the source value set is. However, without a source value set, the server may be unable to safely identify an applicable concept map, and would return an error. For this reason, a source value set SHOULD always be provided. Note that servers may be able to identify an appropriate concept map without a source value set if there is a full mapping for the entire code system in the concept map, or by manual intervention</p>\n</div></td></tr><tr><td>IN</td><td>coding</td><td>0..1</td><td><a href="datatypes.html#Coding">Coding</a></td><td/><td><div><p>A coding to translate</p>\n</div></td></tr><tr><td>IN</td><td>codeableConcept</td><td>0..1</td><td><a href="datatypes.html#CodeableConcept">CodeableConcept</a></td><td/><td><div><p>A full codeableConcept to validate. The server can translate any of the coding values (e.g. existing translations) as it chooses</p>\n</div></td></tr><tr><td>IN</td><td>target</td><td>0..1</td><td><a href="datatypes.html#uri">uri</a></td><td/><td><div><p>Identifies the value set in which a translation is sought. May be a logical id, or an absolute or relative location. If there\'s no target specified, the server should return all known translations, along with their source</p>\n</div></td></tr><tr><td>IN</td><td>targetsystem</td><td>0..1</td><td><a href="datatypes.html#uri">uri</a></td><td/><td><div><p>identifies a target code system in which a mapping is sought. This parameter is an alternative to the target parameter - only one is required. Searching for any translation to a target code system irrespective of the context (e.g. target valueset) may lead to unsafe results, and it is at the discretion of the server to decide when to support this operation</p>\n</div></td></tr><tr><td>IN</td><td>dependency</td><td>0..*</td><td></td><td/><td><div><p>Another element that may help produce the correct mapping</p>\n</div></td></tr><tr><td>IN</td><td>dependency.element</td><td>0..1</td><td><a href="datatypes.html#uri">uri</a></td><td/><td><div><p>The element for this dependency</p>\n</div></td></tr><tr><td>IN</td><td>dependency.concept</td><td>0..1</td><td><a href="datatypes.html#CodeableConcept">CodeableConcept</a></td><td/><td><div><p>The value for this dependency</p>\n</div></td></tr><tr><td>IN</td><td>reverse</td><td>0..1</td><td><a href="datatypes.html#boolean">boolean</a></td><td/><td><div><p>if this is true, then the operation should return all the codes that might be mapped to this code. This parameter reverses the meaning of the source and target parameters</p>\n</div></td></tr><tr><td>OUT</td><td>result</td><td>1..1</td><td><a href="datatypes.html#boolean">boolean</a></td><td/><td><div><p>True if the concept could be translated successfully. The value can only be true if at least one returned match has an equivalence which is not  unmatched or disjoint</p>\n</div></td></tr><tr><td>OUT</td><td>message</td><td>0..1</td><td><a href="datatypes.html#string">string</a></td><td/><td><div><p>Error details, for display to a human. If this is provided when result = true, the message carries hints and warnings (e.g. a note that the matches could be improved by providing additional detail)</p>\n</div></td></tr><tr><td>OUT</td><td>match</td><td>0..*</td><td></td><td/><td><div><p>A concept in the target value set with an equivalence. Note that there may be multiple matches of equal or differing equivalence, and the matches may include equivalence values that mean that there is no match</p>\n</div></td></tr><tr><td>OUT</td><td>match.equivalence</td><td>0..1</td><td><a href="datatypes.html#code">code</a></td><td/><td><div><p>A code indicating the equivalence of the translation, using values from <a href="valueset-concept-map-equivalence.html">ConceptMapEquivalence</a></p>\n</div></td></tr><tr><td>OUT</td><td>match.concept</td><td>0..1</td><td><a href="datatypes.html#Coding">Coding</a></td><td/><td><div><p>The translation outcome. Note that this would never have userSelected = true, since the process of translations implies that the user is not selecting the code (and only the client could know differently)</p>\n</div></td></tr><tr><td>OUT</td><td>match.product</td><td>0..*</td><td></td><td/><td><div><p>Another element that is the product of this mapping</p>\n</div></td></tr><tr><td>OUT</td><td>match.product.element</td><td>0..1</td><td><a href="datatypes.html#uri">uri</a></td><td/><td><div><p>The element for this product</p>\n</div></td></tr><tr><td>OUT</td><td>match.product.concept</td><td>0..1</td><td><a href="datatypes.html#Coding">Coding</a></td><td/><td><div><p>The value for this product</p>\n</div></td></tr><tr><td>OUT</td><td>match.source</td><td>0..1</td><td><a href="datatypes.html#uri">uri</a></td><td/><td><div><p>The canonical reference to the concept map from which this mapping comes from</p>\n</div></td></tr></table><div/></div>',
  },
  extension: [
    {
      url: "http://hl7.org/fhir/StructureDefinition/structuredefinition-fmm",
      valueInteger: 3,
    },
    {
      url: "http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status",
      valueCode: "trial-use",
    },
  ],
  url: "http://hl7.org/fhir/OperationDefinition/ConceptMap-translate",
  version: "4.0.1",
  name: "Concept Translation",
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
    "Translate a code from one value set to another, based on the existing value set and concept maps resources, and/or other additional knowledge available to the server. \r\n\r\n One (and only one) of the in parameters (code, coding, codeableConcept) must be provided, to identify the code that is to be translated.  \r\n\r\n The operation returns a set of parameters including a 'result' for whether there is an acceptable match, and a list of possible matches. Note that the list of matches may include notes of codes for which mapping is specifically excluded, so implementers have to check the match.equivalence for each match",
  code: "translate",
  resource: ["ConceptMap"],
  system: false,
  type: true,
  instance: true,
  parameter: [
    {
      name: "url",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "A canonical URL for a concept map. The server must know the concept map (e.g. it is defined explicitly in the server's concept maps, or it is defined implicitly by some code system known to the server.",
      type: "uri",
    },
    {
      name: "conceptMap",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "The concept map is provided directly as part of the request. Servers may choose not to accept concept maps in this fashion.",
      type: "ConceptMap",
    },
    {
      name: "conceptMapVersion",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "The identifier that is used to identify a specific version of the concept map to be used for the translation. This is an arbitrary value managed by the concept map author and is not expected to be globally unique. For example, it might be a timestamp (e.g. yyyymmdd) if a managed version is not available.",
      type: "string",
    },
    {
      name: "code",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "The code that is to be translated. If a code is provided, a system must be provided",
      type: "code",
    },
    {
      name: "system",
      use: "in",
      min: 0,
      max: "1",
      documentation: "The system for the code that is to be translated",
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
      name: "source",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "Identifies the value set used when the concept (system/code pair) was chosen. May be a logical id, or an absolute or relative location. The source value set is an optional parameter because in some cases, the client cannot know what the source value set is. However, without a source value set, the server may be unable to safely identify an applicable concept map, and would return an error. For this reason, a source value set SHOULD always be provided. Note that servers may be able to identify an appropriate concept map without a source value set if there is a full mapping for the entire code system in the concept map, or by manual intervention",
      type: "uri",
    },
    {
      name: "coding",
      use: "in",
      min: 0,
      max: "1",
      documentation: "A coding to translate",
      type: "Coding",
    },
    {
      name: "codeableConcept",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "A full codeableConcept to validate. The server can translate any of the coding values (e.g. existing translations) as it chooses",
      type: "CodeableConcept",
    },
    {
      name: "target",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "Identifies the value set in which a translation is sought. May be a logical id, or an absolute or relative location. If there's no target specified, the server should return all known translations, along with their source",
      type: "uri",
    },
    {
      name: "targetsystem",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "identifies a target code system in which a mapping is sought. This parameter is an alternative to the target parameter - only one is required. Searching for any translation to a target code system irrespective of the context (e.g. target valueset) may lead to unsafe results, and it is at the discretion of the server to decide when to support this operation",
      type: "uri",
    },
    {
      name: "dependency",
      use: "in",
      min: 0,
      max: "*",
      documentation: "Another element that may help produce the correct mapping",
      part: [
        {
          name: "element",
          use: "in",
          min: 0,
          max: "1",
          documentation: "The element for this dependency",
          type: "uri",
        },
        {
          name: "concept",
          use: "in",
          min: 0,
          max: "1",
          documentation: "The value for this dependency",
          type: "CodeableConcept",
        },
      ],
    },
    {
      name: "reverse",
      use: "in",
      min: 0,
      max: "1",
      documentation:
        "if this is true, then the operation should return all the codes that might be mapped to this code. This parameter reverses the meaning of the source and target parameters",
      type: "boolean",
    },
    {
      name: "result",
      use: "out",
      min: 1,
      max: "1",
      documentation:
        "True if the concept could be translated successfully. The value can only be true if at least one returned match has an equivalence which is not  unmatched or disjoint",
      type: "boolean",
    },
    {
      name: "message",
      use: "out",
      min: 0,
      max: "1",
      documentation:
        "Error details, for display to a human. If this is provided when result = true, the message carries hints and warnings (e.g. a note that the matches could be improved by providing additional detail)",
      type: "string",
    },
    {
      name: "match",
      use: "out",
      min: 0,
      max: "*",
      documentation:
        "A concept in the target value set with an equivalence. Note that there may be multiple matches of equal or differing equivalence, and the matches may include equivalence values that mean that there is no match",
      part: [
        {
          name: "equivalence",
          use: "out",
          min: 0,
          max: "1",
          documentation:
            "A code indicating the equivalence of the translation, using values from [ConceptMapEquivalence](valueset-concept-map-equivalence.html)",
          type: "code",
        },
        {
          name: "concept",
          use: "out",
          min: 0,
          max: "1",
          documentation:
            "The translation outcome. Note that this would never have userSelected = true, since the process of translations implies that the user is not selecting the code (and only the client could know differently)",
          type: "Coding",
        },
        {
          name: "product",
          use: "out",
          min: 0,
          max: "*",
          documentation: "Another element that is the product of this mapping",
          part: [
            {
              name: "element",
              use: "out",
              min: 0,
              max: "1",
              documentation: "The element for this product",
              type: "uri",
            },
            {
              name: "concept",
              use: "out",
              min: 0,
              max: "1",
              documentation: "The value for this product",
              type: "Coding",
            },
          ],
        },
        {
          name: "source",
          use: "out",
          min: 0,
          max: "1",
          documentation:
            "The canonical reference to the concept map from which this mapping comes from",
          type: "uri",
        },
      ],
    },
  ],
};
