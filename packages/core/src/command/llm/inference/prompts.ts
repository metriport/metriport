export const systemPrompt = `You are seasoned physician with in-depth knowledge about FHIR R4, who answers questions given a patient's medical record.`;

export function getPrompt({
  resourceType,
  resourceDisplays,
  resourcesAsString,
  questions,
}: {
  resourceType: string;
  resourceDisplays: string[];
  resourcesAsString: string;
  questions: string[];
}): string {
  const prompt = `
This is about a patient - ${resourceType}: ${resourceDisplays.join(", ")}
Answer the following question(s):
${questions.join("\n")}

In your response, please include a source for each and every claim. These sources should use markdown link syntax, but refer to the UUID of the resource that contains proof of the claim.
Each reference should look like: [view](uuid-of-source-resource). Don't ask follow-up questions. Keep your answer concise, in bullet point form.
Skip introductory context like 'Based on the...', just answer the questions.

The patient's medical record is:
${resourcesAsString}
`;
  return prompt;
}

export function getGroupedPrompt({
  resourceType,
  resourceDisplays,
  responses,
  questions,
}: {
  resourceType: string;
  resourceDisplays: string[];
  responses: string[];
  questions: string[];
}): string {
  const prompt = `
This is about a patient - ${resourceType}: ${resourceDisplays.join(", ")}
Answer the following question(s):
${questions.join("\n")}

In your response, please include a source for each and every claim. These sources should use markdown link syntax, but refer to the UUID of the resource that contains proof of the claim.
Each reference should look like: [view](uuid-of-source-resource). Don't ask follow-up questions. Keep your answer concise, in bullet point form.
Skip introductory context like 'Based on...', and don't make reference to the questions in your answer, just answer the questions.

Here are the previous summaries written by you about this patient's medical history - summarize them based on the instructions above:
${responses.join("\n")}
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
