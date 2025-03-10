const todaysDate = new Date().toISOString().split("T")[0];
const systemPrompt = "You are an expert primary care doctor.";

export const documentVariableName = "text";
export const mainSummaryPrompt = `
${systemPrompt}

Today's date is ${todaysDate}.
Your goal is to write a summary of the patient's most recent medical history, so that another doctor can understand the patient's medical history to be able to treat them effectively.
Here is a portion of the patient's medical history:
--------
{${documentVariableName}}
--------

Write a summary of the patient's most recent medical history, considering the following goals:
1. Specify whether a DNR or POLST form has been completed.
2. Include a summary of the patient's most recent hospitalization, including the location of the hospitalization, the date of the hospitalization, the reason for the hospitalization, and the results of the hospitalization.
3. Include a summary of the patient's current chronic conditions, allergies, and any previous surgeries.
4. Include a summary of the patient's current medications, including dosages and frequency - do not include instructions on how to take the medications. Include any history of medication allergies or adverse reactions.
5. Include any other relevant information about the patient's health.

If any of the above information is not present, do not include it in the summary.
Don't tell me that you are writing a summary, just write the summary. Also, don't tell me about any limitations of the information provided.

SUMMARY:
`;

export const refinedSummaryPrompt = `
${systemPrompt}

Today's date is ${todaysDate}.
Your goal is to write a summary of the patient's most recent medical history, so that another doctor can understand the patient's medical history to be able to treat them effectively.
Here are the previous summaries written by you of sections of the patient's medical history:
--------
{${documentVariableName}}
--------

Combine these summaries into a single, comprehensive summary of the patient's most recent medical history in a single paragraph.

Don't tell me that you are writing a summary, just write the summary. Also, don't tell me about any limitations of the information provided.

SUMMARY:
`;
