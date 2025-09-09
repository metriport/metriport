import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import axios, { AxiosInstance } from "axios";

export class OpenAIClient {
  private readonly axiosInstance: AxiosInstance;

  constructor({ baseURL }: { baseURL: string }) {
    this.axiosInstance = axios.create({
      baseURL,
    });
  }

  async invokeModel() {
    const response = await this.axiosInstance.post(
      "/api/chat",
      {
        model: "gpt-oss-120b",
        messages: [
          {
            role: "system",
            content:
              "You are a medical assistant that passes medical text that concerns medications to the appropriate tool. The user will " +
              "provide the text in the user's message. The tool will return FHIR resources containing RxNorm codes in the resulting bundle. Your job is to " +
              "execute the tools and validate the resulting FHIR resources, suggesting changes if necessary.",
          },
          {
            role: "user",
            content:
              "CHIEF COMPLAINT:,  The patient comes for bladder instillation for chronic interstitial cystitis.,SUBJECTIVE:,  The patient is crying today when she arrives in the office saying that she has a lot of discomfort.  These bladder instillations do not seem to be helping her.  She feels anxious and worried.  She does not think she can take any more pain.  She is debating whether or not to go back to Dr. XYZ and ask for the nerve block or some treatment modality to stop the pain because she just cannot function on a daily basis and care for her children unless she gets something done about this, and she fears these bladder instillations because they do not seem to help.  They seem to be intensifying her pain.  She has the extra burden of each time she comes needing to have pain medication one way or another, thus then we would not allow her to drive under the influence of the pain medicine.  So, she has to have somebody come with her and that is kind of troublesome to her.  We discussed this at length.  I did suggest that it was completely appropriate for her to decide.  She will terminate these if they are that uncomfortable and do not seem to be giving her any relief, although I did tell her that occasionally people do have discomfort with them and then after the completion of the instillations, they do better and we have also had some people who have had to terminate the instillations because they were too uncomfortable and they could not stand it and they went on to have some other treatment modality.  She had Hysterectomy in the past.,MEDICATIONS: , Premarin 1.25 mg daily, Elmiron 100 mg t.i.d., Elavil 50 mg at bedtime, OxyContin 10 mg three tablets three times a day, Toprol XL 25 mg daily.,ALLERGIES:,  Compazine and Allegra.,OBJECTIVE:,Vital Signs:  Weight:  140 pounds.  Blood pressure:  132/90.  Pulse:  102.  Respirations:  18.  Age:  27.,PLAN:,  We discussed going for another evaluation by Dr. XYZ and seeking his opinion.  She said that she called him on the phone the other day and told him how miserable she was and he told her that he really thought she needed to complete.  The instillations give that a full trial and then he would be willing to see her back.  As we discussed these options and she was encouraged to think it over and decide what she would like to do for I could not makeup her mind for her.  She said she thought that it was unreasonable to quit now when she only had two or three more treatments to go, but she did indicate that the holiday weekend coming made her fearful and if she was uncomfortable after today‚Äôs instillation which she did choose to take then she would choose to cancel Friday‚Äôs appointment, also that she would not feel too badly over the holiday weekend.  I thought that was reasonable and agreed that that would work out.,PROCEDURE:,:  She was then given 10 mg of morphine subcutaneously because she did not feel she could tolerate the discomfort in the instillation without pain medicine.  We waited about 20 minutes.  The bladder was then instilled and the urethra was instilled with lidocaine gel which she tolerated and then after a 10-minute wait, the bladder was instilled with DMSO, Kenalog, heparin, and sodium bicarbonate, and the catheter was removed.  The patient retained the solution for one hour, changing position every 15 minutes and then voided to empty the bladder.  She seemed to tolerate it moderately well.  She is to call and let me know what she wishes to do about the Friday scheduled bladder instillation if she tolerated this then she is going to consider trying it.  If not, she will cancel and will start over next week or she will see Dr. Friesen.",
          },
        ],
        tools: [
          {
            name: "rxNorm",
            description: "Infer RxNorm codes from text",
            parameters: zodToJsonSchema(z.object({ text: z.string() })),
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.data);
    return response.data;
  }
}

async function main() {
  const client = new OpenAIClient({ baseURL: "http://localhost:11434" });
  await client.invokeModel();
}

main();
