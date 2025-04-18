export const documentVariableName = "text";

const systemPrompt = "You are an expert on the patient's medical history.";

const jsonTemplate = `
    {{
      "summary": "Your summary text with citation markers like [1], [2], etc.",
      "citations": [
        {{
          "id": "citation-1",
          "marker": "[1]",
          "resourceType": "The FHIR resource type for example: Observation",
          "description": "Description of the FHIR resource",
          "date": "Date of the FHIR resource",
          "sourceId": "UUID of the FHIR resource for example: 123e4567-e89b-12d3-a456-426614174000"
        }}
      ],
      "relevantResources": [
        {{
          "id": "The UUID of the FHIR resource that is relevant to the search query for example: 123e4567-e89b-12d3-a456-426614174000"
        }}
      ]
    }}
`;

export function createPromptWithJsonOutput(query: string, bundleText: string): string {
  return `
    ${systemPrompt}

    A medical professional is looking to surface relevant medical information from the patient's medical history based on a search query.
    The search query can either be keywords or a specific question.

    The search query is:
    ${query}

    Here is the patient's medical history in FHIR R4 format:

    --------
    ${bundleText}
    --------

    Please create a concise summary that extracts the key medical information associated with the search query.
    Include citations to the resource where the information was found by using the number in brackets [1], [2], etc. after each key piece of information.

    Also, include the relevant resources UUIDs from the FHIR resources associated with the search query in the "relevantResources" array.
    Also make sure that any resources that are included in the relevantResources array also include any resources that are referenced in the resource.
    For example, if a DiagnosticReport references an Encounter in encounter.reference, make sure to include the Encounter ID in the relevantResources array.

    Your response MUST be in the following JSON format and nothing else in the response:
    ${jsonTemplate}

    Focus on medical findings, diagnoses, treatments, and outcomes.
    Maintain medical accuracy and use proper terminology.
`;
}
