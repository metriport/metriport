export const documentVariableName = "text";
export function createPromptWithJsonOutput(query: string, context: string): string {
  return `
    Human: I need a summary of the following medical information.
    ${query ? `My specific question is: ${query}` : "Please provide a general summary."}

    Here are the source documents:

    ${context}

    Please create a concise summary that extracts the key medical information.
    Include citations by using the number in brackets [1], [2], etc. after each key piece of information.
    I also would like to limit the number of citations to 6.

    Your response MUST be in the following JSON format and nothing else in the response:
    {
      "summary": "Your summary text with citation markers like [1], [2], etc.",
      "citations": [
        {
          "id": "citation-1",
          "marker": "[1]",
          "description": "Description of the document",
          "date": "Date of the document",
          "sourceId": "Unique identifier for this document section"
        },
        // Additional citations as needed
      ]
    }

    Focus on medical findings, diagnoses, treatments, and outcomes.
    Maintain medical accuracy and use proper terminology.
`;
}
