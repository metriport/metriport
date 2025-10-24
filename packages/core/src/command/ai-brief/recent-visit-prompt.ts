import { buildDayjs } from "@metriport/shared/common/date";

const todaysDate = buildDayjs().format("YYYY-MM-DD");
const systemPrompt = `You are a medical record reviewer and your task is to extract key information from a patient's medical chart.
  Do not include any demographic information such as name, date of birth, address, or other personal identifiers in your summary.`;

export const documentVariableName = "text";

const instructions = `
Instructions:

Create a two section summary:

** Core Summary **
Write a summary of the patient's most recent medical history, considering the following goals:
1. Specify whether a DNR or POLST form has been completed.
2. Include a summary of the patient's most recent hospitalization, including the location of the hospitalization, the date of the hospitalization, the reason for the hospitalization, and the results of the hospitalization.
3. Include a summary of the patient's current chronic conditions, allergies, and any previous surgeries.
4. Include a summary of the patient's current medications, including dosages and frequency - do not include instructions on how to take the medications. Include any history of medication allergies or adverse reactions.
5. Include any other relevant information about the patient's health.

If any of the above information is not present, do not include it in the summary.
Don't tell me that you are writing a summary, just write the summary. Also, don't tell me about any limitations of the information provided.

** PCP Visits **
Review the patient medical records and format the output EXACTLY as follows, including the bullet points and indentation:
    PCP Visits (up to last 24 months)
    - [PCP Name], [PCP Specialty]
      - [Visit Date MM/DD/YYYY]
    - [PCP Name], [PCP Specialty]
      - [Visit Date MM/DD/YYYY]

Problem List (up to last 24 months):
For any condition found, provide the most recent diagnosis date from the patient's record.
  - [Condition] ([MM/DD/YYYY])
  - [Condition] ([MM/DD/YYYY])
Make sure any HCCs or Conditions are flagged.

Medications Prescribed (up to last 24 months):
Only include medications that have a MedicationRequest (prescription).
For each prescription found, provide the prescription date from the MedicationRequest.
  - [Medication Name] ([Prescription Date MM/DD/YYYY])
   - [Medication Name] ([Prescription Date MM/DD/YYYY])

For the PCP visit:
- Find any visit with a provider who is an MD, DO, NP, or PA AND in the specialty of Family Medicine, Internal Medicine, or OB/GYN
- Group all visits by provider (up to last 24 months).
- Do not include telephone encounters
- Provider specialty must be Family Medicine, Internal Medicine, or OB/GYN
- ONLY include providers where you can clearly see their specialty information in the medical records
- If a provider's specialty is not clearly documented or is missing, DO NOT include them in the PCP visits list

For PCP name, only include the physician if they are a MD, DO, NP, PA and are associated with the specialty of Family Medicine,
Internal Medicine or OB/GYN. If you cannot determine their specialty from the available data, exclude them from the list.

CRITICAL DATE FILTERING: All dates must be within the last 24 months from the latest report date.
The data has already been filtered to include the most relevant timeframe of medical records (up to 24 months maximum).

CRITICAL: If there is no data within the available timeframe (up to 24 months), DO NOT include that section at all.
Do not show sections with old data. Do not modify dates to make them appear recent.

If any of the above information is not present, do not include that section in the summary at all.
Do not write "No data available" or similar messages for empty sections - simply omit those sections entirely.
Don't tell me that you are writing a summary, just write the summary. Also, don't tell me about any limitations of the information provided.
Consolidate information and link directly to original sources. Avoid any relative terms, e.g. "recently" or "currently." Use specific dates only.
`;

export const mainSummaryPrompt = `
${systemPrompt}

Today's date is ${todaysDate}.
Review the patient medical records:
--------
{${documentVariableName}}
--------
${instructions}
`;

export const refinedSummaryPrompt = `
${systemPrompt}

Today's date is ${todaysDate}.
Here are the previous summaries written by you of sections of the patient's medical history:
--------
{${documentVariableName}}
--------

Combine these summaries into a comprehensive summary, but retain the structure of the underlying summary.
Use these ${instructions}.
`;
