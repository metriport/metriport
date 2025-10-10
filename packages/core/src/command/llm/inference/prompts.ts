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
  AllergyIntolerance: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Reaction Details**: Describe the symptoms and manifestations
- **Severity and Risk**: Explain how severe the reaction is and life-threatening status
- **Onset and History**: When this allergy was first identified
- **Cross-Reactivities**: Related allergies or cross-reactivities to be aware of

### Questions

Answer the following question(s):
- What type of reaction occurred (symptoms/manifestations)?
- How severe was the reaction, and is this life-threatening?
- When was this allergy first identified?
- Are there any related allergies or cross-reactivities to be aware of?`,

  Condition: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Diagnosis**: How this condition was diagnosed
- **Origin and Timeline**: How and when this condition came to be
- **Clinical Context**: Where, when, and by whom this was diagnosed
- **Documentation**: Associated notes, reports, or imaging
- **Treatment Plan**: Future treatment plans, follow-up appointments, or medications

### Questions

Answer the following question(s):
- How was this diagnosed?
- How did this come to be?
- Where, when, and by whom was this diagnosed?
- Is there any documentation (notes, reports, imaging) associated with this condition? If so, what are they?
- If present, what is the plan to treat this resource in the future? Are there any follow-up appointments, medications, or other plans in the source document?`,

  MedicationStatement: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Indication**: The condition this medication is treating
- **Dosage and Administration**: Dosage, frequency, and duration details
- **Current Status**: Whether the patient is currently taking this or if it has been discontinued
- **Prescriber Information**: Who prescribed this medication and when

### Questions

Answer the following question(s):
- What condition is this medication treating (indication)?
- What is the dosage, frequency, and duration?
- Is the patient currently taking this medication, or has it been discontinued?
- Who prescribed this medication and when?`,

  Procedure: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Indication**: Why this procedure was performed
- **Procedure Details**: When, where, and by whom it was performed
- **Complications**: Any complications or adverse events
- **Outcomes**: Outcomes or findings from the procedure

### Questions

Answer the following question(s):
- Why was this procedure performed (indication)?
- When and where was it performed, and by whom?
- Were there any complications or adverse events?
- What were the outcomes or findings from this procedure?`,

  Encounter: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Chief Complaint**: The reason for this visit
- **Diagnoses**: Diagnoses made or conditions addressed during this encounter
- **Treatments**: Treatments or interventions provided
- **Disposition**: Disposition and follow-up plans (admitted, discharged, etc.)

### Questions

Answer the following question(s):
- What was the reason for this visit (chief complaint)?
- What diagnoses were made or conditions addressed during this encounter?
- What treatments or interventions were provided?
- What was the disposition (admitted, discharged home, follow-up plans)?`,

  Immunization: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Vaccine Information**: What vaccine was administered and for which disease
- **Administration Details**: When it was given and which dose in the series
- **Adverse Reactions**: Any adverse reactions or side effects
- **Follow-up**: When the next dose is due, if applicable

### Questions

Answer the following question(s):
- What vaccine was administered and for which disease?
- When was it given, and which dose in the series is this?
- Were there any adverse reactions or side effects?
- When is the next dose due, if applicable?`,

  DiagnosticReport: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Indication**: Why this test was ordered
- **Key Findings**: The key findings or results
- **Abnormalities**: Any abnormal values that require attention
- **Clinical Interpretation**: Clinical notes or interpretation provided

### Questions

Answer the following question(s):
- If a test, why was this test ordered?
- What were the key findings or results?
- Are there any abnormal values that require attention?
- What clinical notes or interpretation are provided?`,

  Observation: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Measurement**: What was measured and the value
- **Clinical Significance**: Whether this value is normal or indicates an abnormality
- **Context**: Why this observation was made (clinical context)
- **Trends**: How this compares to previous measurements

### Questions

Answer the following question(s):
- What was measured and what is the value?
- Is this value normal, or does it indicate an abnormality?
- Why was this observation made (clinical context)?
- How does this compare to previous measurements (trend)?`,

  Suspects: () => `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Reason for Creation**: Why this suspect was created
- **Related Resources**: The related resources that are responsible for this suspect
- **Key Observations**: Other important observations related to this suspect

### Questions

Answer the following question(s):
- Why was this suspect created?
- What are the related resources that are responsible for this suspect?
- Other key observations related to this suspect?`,
};

export function defaultTemplateHandler(): string {
  return `### Response Structure

Your response should be organized as a series of sections, each with informational bullet points below. Use the following section titles to structure your answer:
- **Clinical Significance**: Why this is important
- **Associated Notes**: Any related notes or documentation
- **Context**: Important context surrounding this resource

### Questions

Answer the following question(s):
- Why is this important?
- Are there any related notes?
- What is the important context surrounding this?`;
}
