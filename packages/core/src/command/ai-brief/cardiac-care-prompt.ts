import { buildDayjs } from "@metriport/shared/common/date";

const todaysDate = buildDayjs().format("YYYY-MM-DD");
const systemPrompt =
  "You are a medical record reviewer and your task is to extract key information from a patient's medical chart. Do not include any demographic information such as name, date of birth, address, or other personal identifiers in your summary.";

export const documentVariableName = "text";

const instructions = `
Instructions:

You need to create a succinct Patient Summary with the following five sections:
**1. Cardiac Conditions**
Review the clinical data for evidence (with dates) of these specific cardiac conditions: Hypertension (HTN), Coronary Artery Disease (CAD), Congestive Heart Failure (CHF), Atrial Fibrillation (AFib), Peripheral Vascular Disease (PVD), and Hyperlipidemia. For each condition found, note whether it's currently active, resolved, or under investigation.
**2. Cardiovascular Medications**
Identify all medications used to treat the cardiac conditions mentioned above. Organize these medications into three categories:
- Active medications (currently prescribed/being taken)
- Stopped medications (discontinued with reason if available)
- Previously tried medications (attempted but changed)
For each medication, include the last fill date and days supply when this information is available.
**3. Non-Cardiac Chronic Risk Factors**
Identify chronic conditions that may interact with or impact cardiac health management. Prioritize conditions such as:
- Kidney disease/chronic kidney disease
- Diabetes and other endocrine disorders
- Obesity
- Substance abuse
- Other conditions that may complicate cardiovascular care
**4. Acute Events**
Look for recent acute healthcare encounters including:
- Emergency Department visits
- Hospitalizations
- Significant symptom escalations or acute exacerbations
Include dates, reasons for the encounters, and outcomes when available.
**5. Care Insights**
If there are any health conditions (excluding those discussed in sections 1 and 3: Heart, Kidney, Endocrine, Obesity, Substance abuse, cardiac complications) that are critical parts of this patient's health status, provide:
- The date of the last encounter where the condition was evaluated or treated
- Assessment of whether the condition appears well-managed or poorly controlled
- Details of prescription drugs actively being used to treat these conditions
- Any notable care gaps or management concerns
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
