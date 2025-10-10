export const systemPrompt = `You are seasoned physician who concisely condenses key details in a medical record to their most useful clinical information. `;

export function getResourceSummaryPrompt({
  resourceType,
  resourceDisplays,
  questions,
  context,
  resourceRowData,
}: {
  resourceType: string;
  resourceDisplays: string[];
  questions: string[];
  context: string;
  resourceRowData?: Record<string, unknown>;
}): string {
  const resourceRowDataString = resourceRowData
    ? `The core data for the resource we are asking about is: ${JSON.stringify(
        resourceRowData,
        null,
        2
      )}`
    : "";

  const prompt = `
This is about a patient.
The resource type is: ${resourceType}
The resource displays are: ${resourceDisplays.join(", ")}
${resourceRowDataString}

---

### Citing claims
In your response, create a source list at the bottom. These sources MUST use markdown link syntax, but have the link point to the UUID of the resource that contains proof of the claim.
Each source should look like: \`[{source-index} - {phrase}](uuid-of-source-resource)\` where {source-index} is a number, {phrase} is a short two or three word phrase that describes the source, such as "glucose measurement", "urinalysis", etc.

If a source is referenced multiple times, include it exactly once, and no more, in the source list.

\`\`\`
Sources:
- [1 - {phrase}](uuid-of-source-resource1)
- [2 - {phrase}](uuid-of-source-resource2)
- [3 - {phrase}](uuid-of-source-resource3)
... etc.
\`\`\`

Then, ensure to include a source for each and every claim you make, using syntax \`_({source-index})_\` at the end of each claim.

### Questions

Answer the following question(s):
${questions.join("\n")}

If you ever don't know a piece of information, instead of saying so, simply say nothing about it.

Keep your answer concise, in bullet point form.

The patient's medical record is:
${context}
`;
  return prompt;
}

export function getResourceSummaryCollationPrompt({
  resourceType,
  resourceDisplays,
  questions,
  responses,
  resourceRowData,
}: {
  resourceType: string;
  resourceDisplays: string[];
  responses: string[];
  questions: string[];
  resourceRowData?: Record<string, unknown>;
}): string {
  const resourceRowDataString = resourceRowData
    ? `The core data for the resource we are asking about is: ${JSON.stringify(
        resourceRowData,
        null,
        2
      )}`
    : "";

  const prompt = `
This is about a patient.
The resource type is: ${resourceType}
The resource displays are: ${resourceDisplays.join(", ")}
${resourceRowDataString}

---

### Citing claims
In your response, create a source list at the bottom. These sources MUST use markdown link syntax, but have the link point to the UUID of the resource that contains proof of the claim.
Each source should look like: \`[{source-index} - {phrase}](uuid-of-source-resource)\` where {source-index} is a number, {phrase} is a short two or three word phrase that describes the source, such as "glucose measurement", "urinalysis", etc.

If a source is referenced multiple times, include it exactly once, and no more, in the source list.

\`\`\`
Sources:
- [1 - {phrase}](uuid-of-source-resource1)
- [2 - {phrase}](uuid-of-source-resource2)
- [3 - {phrase}](uuid-of-source-resource3)
... etc.
\`\`\`

Then, ensure to include a source for each and every claim you make, using syntax \`_({source-index})_\` at the end of each claim.

### Questions

Answer the following question(s):
${questions.join("\n")}

If you ever don't know a piece of information, instead of saying so, simply say nothing about it.

Keep your answer concise, in bullet point form.
Skip introductory context like 'Based on...', and don't make reference to the questions in your answer, just answer the questions.

Here are the previous summaries written by you about this patient's medical history - follow the instructions above and summarize them in order to answer the questions:
${responses
  .map((summary, index) => `------ Summary ${index + 1} ------\n${summary}\n------`)
  .join("\n")}
`;
  return prompt;
}

export const questionsByResourceType = {
  DiagnosticReport: [
    "Why was this done?",
    "Are there any notes associated?",
    "What was the context in which this lab was taken?",
  ],
  Condition: [
    "- How was this diagnosed?",
    "- How did this come to be?",
    "- Where, when, and by whom was this diagnosed?",
    "- Is there any documentation (notes, reports, imaging) associated with this condition? If so, what are they?",
    "- If present, what is the plan to treat this resource in the future? Are there any follow-up appointments, medications, or other plans in the source document?",
  ],
};

export const defaultQuestions = [
  "Why is this important?",
  "Are there any related notes?",
  "What is the important context surrounding this?",
];
