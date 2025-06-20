const todaysDate = new Date().toISOString().split("T")[0];
const systemPrompt =
  "You are a medical record reviewer and your task is to extract key information from a patient's medical chart. Do not include any demographic information such as name, date of birth, address, or other personal identifiers in your summary.";

export const documentVariableName = "text";

const instructions = `
Instructions:
1. Review the patient medical records and format the output EXACTLY as follows, including the bullet points and indentation:
    PCP Visits in last 18 months
    - [PCP Name], [PCP Specialty]
      - [Visit Date MM/DD/YYYY]
    - [PCP Name], [PCP Specialty]
      - [Visit Date MM/DD/YYYY]

    Problem List: [Has Conditions: Yes/No]

    Height (MM/DD/YYYY): [value] inches
    Weight (MM/DD/YYYY): [value] lbs
    BMI (MM/DD/YYYY): [value]

    Qualifying Conditions
    - [Condition] ([MM/DD/YYYY])

    Disqualifying Conditions
    - [Condition] ([MM/DD/YYYY])

    Physician Team Only Indicators
    - [Indicator] ([MM/DD/YYYY])

For any condition found, provide the most recent diagnosis date from the patient's record.

For the PCP visit:
- Only list a PCP if they have had at least one visit in the last 18 months.
- Find any visit with a provider who is an MD, DO, NP, or PA in the specialty of Family Medicine, Internal Medicine, or OB/GYN
- Group all visits from the last 18 months by provider.
- For each provider, list the dates of all their visits as a sub-bullet.
- Do not include telephone encounters
- Provider specialty must be Family Medicine, Internal Medicine, or OB/GYN

For PCP name, only include the physician if they are a MD, DO, NP, PA and are associated with the specialty of Family Medicine, Internal Medicine or OB/GYN.

List of qualifying conditions:
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
- Coronary Artery Disease (Heart Disease, History of MI/Heart Attack > 6 months, etc.)*
- Infertility

List of disqualifying conditions:
- Current pregnancy or currently breastfeeding
- Active cancer or cancer treatment in the last 6 months
- Active drug or alcohol abuse (not including marijuana use)
- CKD Stage 4 or higher (eGFR <29) or kidney transplant
- Active hepatitis or liver disease (fatty liver does not apply)
- Heart attack / stroke / any heart condition that limits daily activity in last 6 months
- Serious uncontrolled mental health conditions: mental health conditions if there is evidence of uncontrolled symptoms or inpatient hospitalization

For Physician Team Only Indicators, list these if present:
- Type 1 Diabetes
- Type 2 Diabetes on insulin
- History of organ transplant
- Adrenal insufficiency
- Currently taking Warfarin or Coumadin
- Cirrhosis

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
