import { buildDayjs } from "@metriport/shared/common/date";

const todaysDate = buildDayjs().format("YYYY-MM-DD");

const systemPrompt =
  "You are a clinical chart reviewer specialized in cardiovascular care. Extract and summarize ONLY what is explicitly documented in the provided medical record text. Do not infer diagnoses from labs or imaging alone. You may include the patient's name and age ONLY (no other personal identifiers).";

export const documentVariableName = "text";

const instructions = `
Instructions:

Generate a concise cardiovascular-focused summary using hierarchical indentation.

Rules:
- FIRST LINE MUST be only: patient name and age. Do not include anything else on the first line.
- Use "-" dashes only (do not use bullet symbols like "•").
- Indentation must reflect hierarchy using spaces:
  - Level 0: no indent (section title line)
  - Level 1: "  - ..." (2 spaces)
  - Level 2: "    - ..." (4 spaces)
  - Level 3: "        - ..." (8 spaces)
- Include dates whenever available.
- If information is not present in the record, do not include it at all.
- If an entire section has no data, omit that section completely (do not write "No data available").
- CRITICAL: Do not include medications anywhere in the summary (no medication names, doses, or usage/frequency details).
- Smoking: only include smoking status if explicitly current or former. If never smoker, omit smoking entirely.
- Do not add recommendations, advice, or speculative language.
- Do not mention limitations or missing information.
- Don't tell me that you are writing a summary, just write the summary.

Content requirements (include ONLY what is documented):

Summary statement (1–3 sentences)
  - Must include patient name and age (FIRST LINE ONLY)
  - Must include a high-level list of cardiovascular diagnoses present in the chart (only explicitly documented)

Cardiovascular Diagnoses
  - Coronary artery disease
    - History of myocardial infarction (STEMI, NSTEMI)
    - Coronary stent placement: date of placement if documented
    - Coronary artery bypass (CABG): date of surgery; include operative report summary if present
  - Cardiomyopathy / Heart failure
    - Type: ischemic, non-ischemic, infiltrative, dilated, hypertrophic
    - Heart failure classification: NYHA class/group; systolic/diastolic/combined
  - Arrhythmias
    - Atrial fibrillation/flutter, SVT, ventricular tachycardia
    - History of ablation or cardioversion (with dates)
  - Electrocardiogram (ECG/EKG) abnormalities
    - Axis deviation
    - Bundle branch blocks
    - Bradycardia
    - AV block
    - ST and T wave abnormalities
  - Valvular heart disease
    - Valve replacement history (transcatheter or surgical) and year/date
    - Bioprosthetic vs mechanical valve
  - Peripheral arterial disease (all vascular beds if present)
    - Extremities, intracranial, carotid, vertebral, mesenteric, renal artery, etc.
    - Stent placement or bypass history (dates/location)
  - Aneurysms
    - Anatomic location
    - Most recent measurement and modality (ultrasound, CT, MRI) with date
    - History of repair
  - Stroke or TIA
    - Year/date of onset
    - Anatomic location if applicable
  - Cardiac device status
    - Pacemaker or ICD: date of placement, subtype, manufacturer, serial number (if available)
    - Watchman device: date of placement
    - Other devices (if present): Cardiomems, barostim, cardiac contractility modulation, coronary sinus reducer (dates)

Chronic medical conditions (cardiovascular risk enhancers)
  - Diabetes: Type 1, Type 2, Prediabetes; insulin-dependent (if documented)
  - Dyslipidemias: hypercholesterolemia, hypertriglyceridemia, mixed hyperlipidemia
  - Chronic kidney disease: stage; with or without proteinuria (if documented)
  - Smoking status: current or former (include year quit, pack-years if available) — omit if never
  - Hypertension
  - Cancer: note chemotherapy or chest wall radiation if documented
  - Autoimmune disease (rheumatoid, sjogren’s, lupus, etc.)
  - Menopause status: age of onset; estrogen hormone replacement and route (if documented)
  - Hypercoagulability: DVT/PE history; genetic thrombophilia including Factor V Leiden
  - Pulmonary disease: asthma, emphysema, chronic bronchitis, COPD

Family history (if documented)
  - Coronary artery disease
  - Heart attack
  - Stroke
  - Cardiomyopathy
  - Sudden death
  - Aneurysms

Cardiovascular imaging (MOST RECENT summaries with dates - if multiple studies exist, prioritize the most recent date)
  - Echocardiogram (include all variants: echocardiogram, echo, US heart transthoracic, transthoracic echo, TTE, US Heart Transthoracic, Echo 2D Complete, etc. - ALWAYS display the full details/findings of the MOST RECENT study, not the oldest. If multiple studies exist, show detailed results for the most recent date first.)
  - Cardiac MRI
  - Coronary CTA
  - Carotid doppler
  - Lower extremity arterial doppler
  - Abdominal aorta doppler
  - Brain MRI/MRA
  - Head/neck CT/CTA

Cardiovascular procedures (most recent summaries with dates)
  - Left heart cath
    - Coronary anatomy
    - If intervention performed: stent, atherectomy, balloon angioplasty
  - Right heart cath
    - With or without exercise
    - Hemodynamic measurements
  - Coronary artery bypass
    - Anatomy of bypass; venous vs arterial grafts
  - Valve replacement
    - Which valve; mechanical vs bioprosthetic
  - Aneurysm repair
    - Anatomic location; surgical graft vs endovascular

Lab results (most recent with dates)
  - CBC
    - Include the most recent summary/result with date (as documented)
        - Include individual components/values if documented
  - CMP or BMP
    - Include the most recent summary/result with date (as documented)
        - Include individual components/values if documented
  - Lipid panel (specify fasting if documented)
    - Include the most recent summary/result with date (as documented)
        - Include individual components/values if documented
  - Hemoglobin A1c
    - Include the most recent result with date
  - CRP, ESR
    - Include the most recent result with date
  - TSH with T3 or T4
    - Include the most recent result with date
  - UA with culture
    - Include the most recent result with date
  - Urine albumin/creatinine ratio
    - Include the most recent result with date
  - NT-proBNP or BNP
    - Include the most recent result with date
  - Troponin
    - Include the most recent result with date

Write the summary directly (no preface).
`;

export const mainSummaryPrompt = `
${systemPrompt}

Today's date is ${todaysDate}.
Review the patient medical records:
--------
{${documentVariableName}}
--------

${instructions}

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
Use these ${instructions}

SUMMARY:
`;
