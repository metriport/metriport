export const systemPrompt = `You are seasoned physician who concisely condenses key details in a medical record to their most useful clinical information. `;

export function getResourceSummaryPrompt({
  resourceType,
  resourceDisplays,
  customPromptSection,
  context,
  resourceRowData,
}: {
  resourceType: string;
  resourceDisplays: string[];
  customPromptSection: string;
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

---

${customPromptSection}

---

### Essential instructions.

- If you ever don't know a piece of information, instead of saying so, simply say nothing about it.
- Skip introductory context like 'Based on...', and don't make reference to the instructions in your answer, just follow the instructions.
- Refer to only the content of the record you are referring back to, never the schema or names of the fields.
- Keep your answer concise, in bullet point form.

### Context
The patient's medical record is:
${context}
`;
  return prompt;
}

export function getResourceSummaryCollationPrompt({
  resourceType,
  resourceDisplays,
  customPromptSection,
  responses,
  resourceRowData,
}: {
  resourceType: string;
  resourceDisplays: string[];
  responses: string[];
  customPromptSection: string;
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

---

${customPromptSection}

---

### Essential instructions.

- If you ever don't know a piece of information, instead of saying so, simply say nothing about it.
- Skip introductory context like 'Based on...', and don't make reference to the instructions in your answer, just follow the instructions.
- Refer to only the content of the record you are referring back to, never the schema or names of the fields.
- Keep your answer concise, in bullet point form.

### Context
Here are the previous summaries written by you about this patient's medical history - follow the instructions above and summarize them:
${responses
  .map((summary, index) => `------ Summary ${index + 1} ------\n${summary}\n------`)
  .join("\n")}
`;
  return prompt;
}

export type ResourceTemplateHandler = (data: {
  resourceType: string;
  resourceDisplays: string[];
  resourceRowData?: Record<string, unknown>;
}) => string;

export const templateHandlersByResourceType: Record<string, ResourceTemplateHandler> = {
  AllergyIntolerance: () => `### Questions

Answer the following question(s):
- What type of reaction occurred (symptoms/manifestations)?
- How severe was the reaction, and is this life-threatening?
- When was this allergy first identified?
- Are there any related allergies or cross-reactivities to be aware of?`,

  Condition: () => `### Questions

Answer the following question(s):
- How was this diagnosed?
- How did this come to be?
- Where, when, and by whom was this diagnosed?
- Is there any documentation (notes, reports, imaging) associated with this condition? If so, what are they?
- If present, what is the plan to treat this resource in the future? Are there any follow-up appointments, medications, or other plans in the source document?`,

  MedicationStatement: () => `### Questions

Answer the following question(s):
- What condition is this medication treating (indication)?
- What is the dosage, frequency, and duration?
- Is the patient currently taking this medication, or has it been discontinued?
- Who prescribed this medication and when?`,

  Procedure: () => `### Questions

Answer the following question(s):
- Why was this procedure performed (indication)?
- When and where was it performed, and by whom?
- Were there any complications or adverse events?
- What were the outcomes or findings from this procedure?`,

  Encounter: () => `### Questions

Answer the following question(s):
- What was the reason for this visit (chief complaint)?
- What diagnoses were made or conditions addressed during this encounter?
- What treatments or interventions were provided?
- What was the disposition (admitted, discharged home, follow-up plans)?`,

  Immunization: () => `### Questions

Answer the following question(s):
- What vaccine was administered and for which disease?
- When was it given, and which dose in the series is this?
- Were there any adverse reactions or side effects?
- When is the next dose due, if applicable?`,

  DiagnosticReport: () => `### Questions

Answer the following question(s):
- If a test, why was this test ordered?
- What were the key findings or results?
- Are there any abnormal values that require attention?
- What clinical notes or interpretation are provided?`,

  Observation: () => `### Questions

Answer the following question(s):
- What was measured and what is the value?
- Is this value normal, or does it indicate an abnormality?
- Why was this observation made (clinical context)?
- How does this compare to previous measurements (trend)?`,

  Suspects: () => `### Questions

Answer the following question(s):
- Why was this suspect created?
- What are the related resources that are responsible for this suspect?
- Other key observations related to this suspect?`,
};

export function defaultTemplateHandler(): string {
  return `### Questions

Answer the following question(s):
- Why is this important?
- Are there any related notes?
- What is the important context surrounding this?`;
}
