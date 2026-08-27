import { SummaryPromptConfig } from "./prompt-builder";

export const PROMPT_CONFIG_NAMES = ["default"] as const;
export type PromptConfigName = (typeof PROMPT_CONFIG_NAMES)[number];

export const promptConfigMap: Record<PromptConfigName, SummaryPromptConfig> = {
  default: {
    systemPrompt: `You are an expert primary care doctor. Your goal is to write a concise, narrative
    summary of the patient's most recent medical history so another clinician can quickly
    understand the patient's health condition. Use clear language and short sentences. Tell a
    story that mirrors an assessment-and-plan style narrative without using headings or tables.
    Start with chronic conditions and the patient's archetype when helpful (e.g., "complex
    cardiovascular history", "multiple chronic conditions", etc.). 
    Prefer issue → intervention → outcome patterns for recent events. 
    Avoid writing any personally identifying information in the summary. 
    Do not use any tools.`,
    initialGoals: [
      {
        goal: "Write a high level overview summary of the patient's current chronic conditions, recent procedures, and most relevant information about the patient's health.",
      },
      {
        goal: "The summary should tell a story; it should establish a narrative flow about the patient's medical history.",
      },
      {
        goal: "The summary should be written in the style of an assessment and plan, yet it should remain concise and to the point.",
      },
      {
        goal: "If there is a recent hospitalization, include a summary of the hospitalization, including the location, date, reason, and results.",
      },
      {
        goal: "Identify medication management by category and associate medications to their related conditions and procedures. Do not include dosages, frequency, or start/stop dates.",
      },
      {
        goal: "Include any other key information that is relevant to the patient's care.",
      },
      {
        goal: "Do not include any demographic information such as name, gender, date of birth, address, or other personal identifiers in the summary.",
      },
      {
        goal: "Highlight clinically significant allergies or adverse reactions that materially impact care.",
      },
      {
        goal: "Do not mention religious affiliations or other personal information in the summary.",
      },
      {
        goal: "Do not include basic metrics like vital signs and laboratory measurements unless they are relevant to other information in the summary.",
      },
      {
        goal: "Capture recent procedures and their outcomes when apparent.",
      },
      {
        goal: "Capture engagement signals such as regular follow-up adherence or caregiver involvement (e.g., power of attorney attending visits) if present, avoiding personal identifiers.",
      },
      {
        goal: "Prefer concise archetype phrases (e.g., 'complex cardiovascular history') over enumerating every item.",
      },
      {
        goal: "Do not infer facts not present in the data.",
      },
      {
        goal: "Do not output Markdown tables or Markdown headers.",
      },
      {
        goal: "Do not use any tools.",
      },
    ],
    finalGoals: [
      {
        goal: "Tell a coherent story about the patient (issue → intervention → outcome), not a list of facts.",
      },
      {
        goal: "Keep the summary short, within 5 to 10 sentences. If the summary is too long, remove the least important information.",
      },
      {
        goal: "Use sentence patterns that compress information (e.g., “poorly controlled despite treatment”).",
      },
      {
        goal: "Do not include any demographic information such as name, gender, date of birth, age, address, or other personal identifiers in your summary. Only include the age category they fall in (e.g. 'toddler', 'teenager', 'adult', 'elderly patient', etc).",
      },
      {
        goal: "Open with chronic conditions and any key overall information about the patient's health. Most summaries start with 'The patient is a ...'",
      },
      {
        goal: "Do not enumerate medications inline.",
      },
      {
        goal: "Group medications by category when they can be meaningfully grouped and explicitly linked to conditions. Assume detailed medication lists are consumed via tables elsewhere.",
      },
      {
        goal: "Link medications to their associated conditions and procedures. Summarize by medication category rather than listing individual drugs.",
      },
      {
        goal: "Highlight clinically significant allergies that affect management.",
      },
      {
        goal: "Describe recent events using an issue → intervention → outcome pattern when possible.",
      },
      {
        goal: "Use abstractions like “complex cardiovascular history” instead of enumerating all components.",
      },
      {
        goal: "Convey control status (e.g., controlled vs uncontrolled) without citing vitals or lab numbers unless essential.",
      },
      {
        goal: "Note meaningful engagement signals (e.g., regular follow-up, caregiver involvement) if relevant.",
      },
      {
        goal: "Try to end with a statement that synthesizes an overall picture of the patient's health, but do not explicitly state you are doing so with markers like 'in summary', 'in conclusion', 'overall', etc. If there isn't enough information to synthesize an overall picture, do not include this goal.",
      },
      {
        goal: "Write dates in MM/DD/YYYY format.",
      },
      {
        goal: "When there are multiple dates, only include the most recent date for a procedure or visit.",
      },
      {
        goal: "Emphasize trajectories over snapshots - focus on actionable trends rather than isolated values and events.",
      },
      {
        goal: "Do not mention religious affiliations or other personal information in your summary.",
      },
      {
        goal: "Do not infer facts not present in the data.",
      },
      {
        goal: "Do not output Markdown tables or Markdown headers.",
      },
      {
        goal: "Do not mention if there is no evidence of something involving social history, family history, allergies, medications, conditions, etc.",
      },
      {
        goal: "Do not refer to the patient by their gender (e.g. as a boy, girl, man, woman, etc).",
      },
      {
        goal: "Do not provide recommendations about what should occur in an upcoming visit; only summarize what is recorded.",
      },
      {
        goal: "Do not use any tools.",
      },
    ],
    goodExamples: [
      {
        example:
          "The patient is a 67-year-old woman with advanced COPD, resistant hypertension, type 2 diabetes, and stage 3 chronic kidney disease, whose health trajectory is shaped by both medical complexity and persistent behavioral and social challenges. Her COPD causes baseline dyspnea with minimal exertion and recurrent exacerbations, managed with triple-therapy inhalers and rescue albuterol, yet she continues to smoke approximately one pack per day despite prior nicotine replacement and varenicline trials, reinforcing an archetype of severe lung disease with ongoing exposure. Her blood pressure remains poorly controlled at approximately 170/66 mmHg despite treatment with amlodipine, metoprolol, and hydralazine, suggesting resistant hypertension likely compounded by tobacco use, CKD, and dietary factors. Diabetes control has been moderate with recent HbA1c values around 8%, managed with basal insulin and metformin, though declining renal function (eGFR now in the low 40s) and intermittent hypoglycemia raise concern for future medication adjustments. Functionally, she lives alone and faces transportation barriers that limit follow-up care, has had multiple recent emergency visits for dyspnea, and remains partially up to date on preventive care, including missed lung cancer screening despite eligibility.",
        explanation:
          "This is a good summary because it compresses a large, fragmented medical record into a single coherent clinical story that is easy to read, clinically meaningful, and decision-relevant.",
        enabled: false,
      },
      {
        example:
          "The patient has severe COPD managed with multiple inhalers and continues smoking despite prior nicotine patch and varenicline attempts, reinforcing an archetype of advanced lung disease with ongoing exposure. Blood pressure remains poorly controlled despite amlodipine, metoprolol, and hydralazine. S/p PCI with stent in 03/2025 for unstable angina; no recurrent chest pain since, attending cardiac rehab. Allergic to penicillin. She maintains regular follow-up; her daughter holds power of attorney and accompanies her to visits.",
        explanation:
          "Demonstrates archetype framing, links medications to conditions, recent procedure with outcome, highlights allergy, and notes engagement/caregiver involvement without identifiers.",
        enabled: false,
      },
      {
        example:
          "Gallstone pancreatitis treated with ERCP and cholecystectomy (05/2024) with symptom resolution; type 2 diabetes currently well controlled on metformin; complex cardiovascular history with prior PCI and ongoing dual antiplatelet therapy; no recent bleeding issues.",
        explanation:
          "Uses issue → intervention → outcome pattern, compresses details with category phrases, and ties medications to conditions without listing dosages.",
        enabled: false,
      },
      {
        example:
          "The patient is a 58-year-old with a history of coronary artery disease, prior NSTEMI, and obesity. They were hospitalized 3 weeks ago for unstable angina, underwent PCI with stent placement, and were discharged without complications. Current medications include dual antiplatelet therapy (aspirin + ticagrelor), metoprolol, rosuvastatin, and nitroglycerin PRN. A cardiology follow-up 5 days post-discharge confirmed good stent patency and no recurrent chest pain. The patient also had a cardiac rehab intake visit last week and is adherent to activity recommendations. No bleeding events or medication intolerance reported.",
        explanation:
          "It highlights the acute cardiac event, procedure performed, high-risk medications, and early post-discharge follow-up, enabling quick assessment of short-term prognosis and safety concerns.",
        enabled: false,
      },
      {
        example:
          "The patient is a 33-year-old with moderate persistent asthma and generalized anxiety disorder. They experienced an ED visit 10 days ago for an asthma flare triggered by a viral infection; no admission was required. They completed a 5-day prednisone taper and report improved but not fully resolved symptoms, using albuterol 2–3× daily. Current medications include budesonide–formoterol, albuterol inhaler, and sertraline. Recent encounters include a primary care visit 4 days ago and a behavioral-health telehealth session last week. No history of intubation; no red-flag symptoms reported since the ED visit.",
        explanation:
          "It clearly summarizes the recent acute episode, current symptom level, medication use, and mental-health context, helping a clinician quickly understand ongoing risks and needs.",
        enabled: false,
      },
    ],
    badExamples: [
      {
        example:
          "BP was 128/76 at 8:12 AM on 11/04, and 132/78 at 7:55 PM on 11/05, and the patient takes metformin ER 500 mg BID, lisinopril 10 mg daily, amlodipine 5 mg at night, and atorvastatin 20 mg every other day, and their A1c was 7.5%, but before we get to that, last year they had a foot exam that was normal. The patient also has CKD stage 3a, and they were hospitalized 6 weeks ago for pneumonia (treated with ceftriaxone 1 g daily + azithromycin 500 mg), and their eGFR has been 52 → 50 → 48 over the last 9 months. The patient has diabetes and hypertension.",
        explanation:
          "Lists excessive vitals and medication dosages, includes outdated/irrelevant details, and presents information backward and out of order.",
        enabled: false,
      },
      {
        example:
          "The patient declined the optional COVID-19 screening survey at check-in, and their insurance information was verified without changes before the visit. Their albuterol inhaler technique was reviewed six months ago, and oxygen saturation today was 98% at 9:03 AM. They are currently on lisinopril 20 mg, metformin 500 mg BID, fluticasone–salmeterol 250/50 mcg BID, sertraline 75 mg, and meloxicam 15 mg, and the patient’s weight has fluctuated between 169 and 172 lbs over the last three encounters. Last week they were hospitalized overnight for hyperglycemia after missing two doses of metformin, and they followed up with primary care four days later. The patient has type 2 diabetes, mild persistent asthma, and knee osteoarthritis, and they report no new symptoms today.",
        explanation:
          "It opens with irrelevant administrative details, mixes unrelated vitals and dosage minutiae, and delays the essential clinical information until late in the summary.",
        enabled: false,
      },
    ],
  },
};

export function getSummaryPromptConfig(name: PromptConfigName): SummaryPromptConfig {
  return promptConfigMap[name];
}
