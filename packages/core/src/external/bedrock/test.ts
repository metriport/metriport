import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
// import { BedrockAgent } from "./agent/agent";
import { AnthropicModel } from "./model/anthropic";
import { AnthropicRequest } from "./model/anthropic/request";
import { AnthropicResponse } from "./model/anthropic/response";
import { AnthropicToolCall } from "./model/anthropic/tools";

async function main() {
  const claude = new AnthropicModel("claude-sonnet-3.7", "us-west-2");

  const convo = await claude.invokeModel({
    max_tokens: 1000,
    temperature: 0,
    system: "You are a helpful assistant.",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "Hello, how are you?" }],
      },
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I'm doing great, thank you for asking!",
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "text", text: "What is the capital of France?" }],
      },
    ],
    tools: [
      {
        type: "custom",
        name: "get_capital",
        description: "Get the capital of a given country.",
        input_schema: zodToJsonSchema(
          z.object({
            country: z.string(),
          })
        ),
      },
    ],
  });

  console.log(JSON.stringify(convo, null, 2));
  if (convo != null) return;

  let response: AnthropicResponse<"claude-sonnet-3.7"> | undefined = undefined;
  const messages: AnthropicRequest<"claude-sonnet-3.7">["messages"] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "HISTORY: , Patient is a 21-year-old white woman who presented with a chief complaint of chest pain.  She had been previously diagnosed with hyperthyroidism.  Upon admission, she had complaints of constant left sided chest pain that radiated to her left arm.  She had been experiencing palpitations and tachycardia.  She had no diaphoresis, no nausea, vomiting, or dyspnea.,She had a significant TSH of 0.004 and a free T4 of 19.3.  Normal ranges for TSH and free T4 are 0.5-4.7 ¬µIU/mL and 0.8-1.8 ng/dL, respectively.  Her symptoms started four months into her pregnancy as tremors, hot flashes, agitation, and emotional inconsistency.  She gained 16 pounds during her pregnancy and has lost 80 pounds afterwards.  She complained of sweating, but has experienced no diarrhea and no change in appetite.  She was given isosorbide mononitrate and IV steroids in the ER.,FAMILY HISTORY:,  Diabetes, Hypertension, Father had a Coronary Artery Bypass Graph (CABG) at age 34.,SOCIAL HISTORY:,  She had a baby five months ago.  She smokes a half pack a day.  She denies alcohol and drug use.,MEDICATIONS:,  Citalopram 10mg once daily for depression; low dose tramadol PRN pain.,PHYSICAL EXAMINATION: , Temperature 98.4; Pulse 123; Respiratory Rate 16; Blood Pressure 143/74.,HEENT:  She has exophthalmos and could not close her lids completely.,Cardiovascular:  tachycardia.,Neurologic:  She had mild hyperreflexiveness.,LAB:,  All labs within normal limits with the exception of Sodium 133, Creatinine 0.2, TSH 0.004, Free T4 19.3 EKG showed sinus tachycardia with a rate of 122.  Urine pregnancy test was negative.,HOSPITAL COURSE: , After admission, she was given propranolol at 40mg daily and continued on telemetry.  On the 2nd day of treatment, the patient still complained of chest pain.  EKG again showed tachycardia.  Propranolol was increased from 40mg daily to 60mg twice daily., A I-123 thyroid uptake scan demonstrated an increased thyroid uptake of 90% at 4 hours and 94% at 24 hours.  The normal range for 4-hour uptake is 5-15% and 15-25% for 24-hour uptake.  Endocrine consult recommended radioactive I-131 for treatment of Graves disease.,Two days later she received 15.5mCi of I-131.  She was to return home after the iodine treatment.  She was instructed to avoid contact with her baby for the next week and to cease breast feeding.,ASSESSMENT / PLAN:,1. Treatment of hyperthyroidism.  Patient underwent radioactive iodine 131 ablation therapy.,2. Management of cardiac symptoms stemming from hyperthyroidism.  Patient was discharged on propranolol 60mg, one tablet twice daily.,3. Monitor patient for complications of I-131 therapy such as hypothyroidism.  She should return to Endocrine Clinic in six weeks to have thyroid function tests performed.  Long-term follow-up includes thyroid function tests at 6-12 month intervals.,4. Prevention of pregnancy for one year post I-131 therapy.  Patient was instructed to use 2 forms of birth control and was discharged an oral contraceptive, taken one tablet daily.,5. Monitor ocular health.  Patient was given methylcellulose ophthalmic, one drop in each eye daily.  She should follow up in 6 weeks with the Ophthalmology clinic.,6. Management of depression.  Patient will be continued on citalopram 10 mg.",
        },
      ],
    },
  ];

  await claude.invokeModel({
    max_tokens: 1000,
    temperature: 0,
    system: "You are a helpful assistant.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `What is the origin story behind printing "hello world"?`,
          },
        ],
      },
    ],
  });

  let iterations = 0;
  do {
    response = await claude.invokeModel({
      max_tokens: 1000,
      temperature: 0,
      thinking: {
        type: "enabled",
        budget_tokens: 1000,
      },
      system:
        "Your role is to choose an extraction tool from the provided tools, and call them with substrings of medical text provided by the user. " +
        "The extraction tools are specialized in tagging the text with medical codes. " +
        "You should pass this text without modification to the appropriate tool for detailed extraction. " +
        "Do not produce any output or tell me what you are doing. " +
        "I will not run the tool if the substring is not found in the original text. " +
        "Do not pass the same text to multiple tools, pick the most relevant tool. " +
        "Try to pass the most concise possible substring of text to the extraction tools, but don't leave out any important details.",
      messages: messages,
      tools: [
        {
          type: "custom",
          name: "extractMedication",
          description: "Extract medication information from the provided medical text.",
          input_schema: zodToJsonSchema(
            z.object({
              text: z.string(),
            })
          ),
        },
        {
          type: "custom",
          name: "extractConditions",
          description: "Extract conditions from the provided medical text with ICD 10 codes.",
          input_schema: zodToJsonSchema(
            z.object({
              text: z.string(),
            })
          ),
        },
        {
          type: "custom",
          name: "extractProcedures",
          description: "Extract procedures from the provided medical text with ICD 10 codes.",
          input_schema: zodToJsonSchema(
            z.object({
              text: z.string(),
            })
          ),
        },
      ],
    });

    console.log(JSON.stringify(response, null, 2));
    if (response.stop_reason === "tool_use") {
      const toolCall = response.content[response.content.length - 1] as AnthropicToolCall;
      messages.push({
        role: "assistant",
        content: [toolCall],
      });

      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: "Finished extraction",
          },
        ],
      });
      console.log(messages);
    }
    iterations++;
  } while (response != null && response.stop_reason === "tool_use" && iterations < 5);
}

main();
