import { buildDayjs } from "@metriport/shared/common/date";

const todaysDate = buildDayjs().format("YYYY-MM-DD");
const systemPrompt =
  "You are a medical record reviewer and your task is to extract key information from a patient's medical chart. Do not include any demographic information such as name, date of birth, address, or other personal identifiers in your summary.";

export const documentVariableName = "text";

const instructions = `
Instructions:
1. Review the patient medical records and format the output EXACTLY as follows, including the bullet points and indentation:
    Problem List: [Has Conditions: Yes/No]
    Height (MM/DD/YYYY): [value] inches
    Weight (MM/DD/YYYY): [value] lbs
    BMI (MM/DD/YYYY): [value]
     Conditions
    - [Condition] ([MM/DD/YYYY])
    Disqualifying Medications
    - [Medications] ([MM/DD/YYYY])
For any condition found, provide the most recent diagnosis date from the patient’s record. Only report exactly the conditions below, according to the additional constraints if applicable.
List of conditions:
- High blood pressure
- Hypertension
- High cholesterol
- Hyperlipidemia
- Dyslipidemia
- Type 2 Diabetes
- Sleep Apnea
- OSA
- Polycystic ovarian syndrome (PCOS)
- Fatty Liver, Hepatic Steatosis, or Non-alcoholic fatty liver disease (NAFLD)*
- Prediabetes Insulin Resistance*
- Current pregnancy or currently breastfeeding
- Active cancer or cancer treatment in the last 6 months
- Active drug or alcohol abuse (not including marijuana use)
- CKD Stage 4 or higher (eGFR <29) or kidney transplant (do not include CKD Stage 1, 2, or 3)
- Active hepatitis or liver disease (do not include fatty liver)
- Heart attack / stroke / any heart condition that limits daily activity in last 3 months
- Serious uncontrolled mental health conditions: mental health conditions if there is evidence of uncontrolled symptoms or inpatient hospitalization

List of Medications:
- nitrates including isosorbide mononitrate, nitroglycerine, etc.

Note: Do not suggest or infer conditions based on lab values or other observations. Only include explicitly documented conditions.
`;

export const mainSummaryPrompt = `
${systemPrompt}

Today's date is ${todaysDate}.
Review the patient medical records:
--------
{${documentVariableName}}
--------
${instructions}

If any of the above information is not present, do not include it in the summary.
Don't tell me that you are writing a summary, just write the summary. Also, don't tell me about any limitations of the information provided.

SUMMARY:
`;

export const refinedSummaryPrompt = `
${systemPrompt}

Today's date is ${todaysDate}.
Here are the previous summaries written by you of sections of the patient's medical history:
--------
{${documentVariableName}}
--------

Combine these summaries into a single, comprehensive summary.
Use these ${instructions}.

Don't tell me that you are writing a summary, just write the summary. Also, don't tell me about any limitations of the information provided.

SUMMARY:
`;
