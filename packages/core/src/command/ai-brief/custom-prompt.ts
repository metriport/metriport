const todaysDate = new Date().toISOString().split("T")[0];
const systemPrompt =
  "You are a medical record reviewer and your task is to extract key information from a patient's medical chart.";

export const documentVariableName = "text";

const instructions = `
Instructions:
1. Review the patient medical records:
2. Extract the following information
    a. Most recent Primary Care Provider (PCP) visit: include the PCP name, credentials, specialty, date, medical list/problem list, medication list. Only include MD, DO, NP, PA visits to the specialty of Family Medicine, Internal Medicine or OB/GYN.
        i. If PCP visit isn't available, use History of Present Illness (HPI) visit instead
    b. Most recent height, weight and date.
    c. Most recent BMI and date.
    d. Indicate if a qualifying condition is present and include only that name and the most recent diagnosis date in the response. Here is the list of qualifying conditions:
        i. High blood pressure or hypertension
        ii. High cholesterol or Hyperlipidemia/Dyslipidemia
        iii. Type 2 Diabetes Sleep Apnea or OSA
        iv. Polycystic ovarian syndrome (PCOS)
        v. Fatty Liver, Hepatic Steatosis, or Non-alcoholic fatty liver disease (NAFLD)*
        vi. Prediabetes Insulin Resistance*
        vii. Coronary Artery Disease (Heart Disease, History of MI/Heart Attack > 6 months, etc.)*
        viii. Infertility
    e. Indicate if a disqualifying condition is present and include only that name and the most recent diagnosis date in the response. Here is the list of disqualifying conditions:
        i. Current pregnancy or currently breastfeeding
        ii. Active cancer or cancer treatment in the last 6 months Active drug or alcohol abuse
        iii. CKD Stage 4 or higher (eGFR <29) or kidney transplant
        iv. Active hepatitis or liver disease (fatty liver does not apply)
        v. Heart attack / stroke / any heart condition that limits daily activity in last 6 months
        vi. Serious uncontrolled mental health conditions: mental health conditions if there is evidence of uncontrolled symptoms or inpatient hospitalization.
    f. Indicate if a patient is on a qualifying medication and has a fill date in the last 60 days. Your response should include the medication name and recent fill date.
        i. Alli or Xenical (orlistat)
        ii. Bupropion Contrave (naltrexone-bupropion)
        iii. Diethylpropion
        iv. Metformin
        v. Mounjaro (tirzepatide)
        vi. Naltrexone
        vii. Ozempic (semaglutide)
        viii. Phentermine (Lomaira)
        ix. Qsymia (phentermine + topiramate ER)
        x. Rybelsus (oral semaglutide)
        xi. Saxenda (liraglutide)
        xii. Topiramate Trulicity (dulaglutide)
        xiii. Victoza (liraglutide)
        xiv. Wegovy (semaglutide)
        xv. Zonisamide
    g. Indicate if a patient is on a disqualifying medication and has a fill date in the last 60 days. Your response should include the medication name and recent fill date.
        i. Daily use of oral steroid meds equivalent or higher than prednisone 20 mg twice daily (not including inhalers)
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
