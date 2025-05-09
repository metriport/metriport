const todaysDate = new Date().toISOString().split("T")[0];
const systemPrompt =
  "You are a medical record reviewer and your task is to extract key information from a patient's medical chart. Do not include any demographic information such as name, date of birth, address, or other personal identifiers in your summary.";

export const documentVariableName = "text";

const instructions = `
Instructions:
1. Review the patient medical records and format the output EXACTLY as follows:
    Most recent Primary Care Provider (PCP) visit (Date: [date]):
    PCP Name: [name], [credentials] [specialty]

    Medical / Problem List: [comma separated list of conditions]
    Medication List: [comma separated list of medications]
    Note: Include all office visits, outpatient visits, and established patient visits where the provider is an MD, DO, NP, or PA in the specialty of Family Medicine, Internal Medicine, or OB/GYN.
    If you find a PCP visit, also check for any other visits from the same provider - use the most recent one.
    If PCP visit isn't available, use History of Present Illness (HPI) visit instead

    Most recent height (Date: [date]): [value] in
    Most recent weight (Date: [date]): [value] lbs
    Most Recent Body mass index (BMI)  ([date]): [value]

    Qualifying Conditions: [Comma separated list of conditions with their most recent diagnosis date]
    Disqualifying Conditions: [Comma separated list of conditions with their most recent diagnosis date]
    Qualifying Medications: [Comma separated list of medications with their fill date in the last 60 days]
    Disqualifying Medications: [Comma separated list of medications with their fill date in the last 60 days]

    Physician Team Only Indicators: [Comma separated list of the following conditions/medications if present]
    - Type 1 Diabetes
    - Type 2 Diabetes on insulin
    - History of organ transplant
    - Adrenal insufficiency
    - Currently taking Warfarin or Coumadin

For the PCP visit:
- Find any visit with a provider who is an MD, DO, NP, or PA in the specialty of Family Medicine, Internal Medicine, or OB/GYN
- Once you find a qualifying provider, look for ALL their visits and use the most recent one
- Do not filter by visit type - consider all visits from the same provider
- Provider specialty must be Family Medicine, Internal Medicine, or OB/GYN

For PCP name, only include the physician if they are a MD, DO, NP, PA and are associated with the specialty of Family Medicine, Internal Medicine or OB/GYN.

List of qualifying conditions:
- High blood pressure or hypertension
- High cholesterol or Hyperlipidemia/Dyslipidemia
- Type 2 Diabetes Sleep Apnea or OSA
- Polycystic ovarian syndrome (PCOS)
- Fatty Liver, Hepatic Steatosis, or Non-alcoholic fatty liver disease (NAFLD)*
- Prediabetes Insulin Resistance*
- Coronary Artery Disease (Heart Disease, History of MI/Heart Attack > 6 months, etc.)*
- Infertility

List of disqualifying conditions:
- Current pregnancy or currently breastfeeding
- Active cancer or cancer treatment in the last 6 months
- Active drug or alcohol abuse
- CKD Stage 4 or higher (eGFR <29) or kidney transplant
- Active hepatitis or liver disease (fatty liver does not apply)
- Heart attack / stroke / any heart condition that limits daily activity in last 6 months
- Serious uncontrolled mental health conditions: mental health conditions if there is evidence of uncontrolled symptoms or inpatient hospitalization

List of qualifying medications (only include if prescribed in the last 60 days):
- Alli or Xenical (orlistat)
- Bupropion Contrave (naltrexone-bupropion)
- Diethylpropion
- Metformin
- Mounjaro (tirzepatide)
- Naltrexone
- Ozempic (semaglutide)
- Phentermine (Lomaira)
- Qsymia (phentermine + topiramate ER)
- Rybelsus (oral semaglutide)
- Saxenda (liraglutide)
- Topiramate Trulicity (dulaglutide)
- Victoza (liraglutide)
- Wegovy (semaglutide)
- Zonisamide

List of disqualifying medications (only include if prescribed in the last 60 days):
- Daily use of oral steroid meds equivalent or higher than prednisone 20 mg twice daily (not including inhalers)

Note: Do not suggest or infer conditions based on lab values or other observations. Only include explicitly documented conditions and medications.
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
