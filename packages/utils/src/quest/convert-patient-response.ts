import { QuestConvertPatientResponseHandlerDirect } from "@metriport/core/external/quest/command/convert-patient-response/convert-patient-response-direct";
import { BadRequestError } from "@metriport/shared";
import {
  isValidQuestRosterType,
  QuestRosterType,
} from "@metriport/shared/interface/external/quest/roster";
import { Command } from "commander";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Converts a Quest patient response into a FHIR bundle.
 */
const program = new Command();

interface ConvertPatientResponseOptions {
  externalId: string;
  dateId: string;
  rosterType: QuestRosterType;
}

program
  .name("convert-patient-response")
  .requiredOption("--external-id <externalId>", "The external ID")
  .requiredOption("--date-id <dateId>", "The date ID")
  .requiredOption("--roster-type <rosterType>", "The roster type")
  .description("Converts a Quest patient response into a FHIR bundle.")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function ({ externalId, dateId, rosterType }: ConvertPatientResponseOptions) {
    if (!isValidQuestRosterType(rosterType)) {
      throw new BadRequestError("Invalid roster type", undefined, { rosterType });
    }
    await confirm(
      `You are about to convert a Quest patient response for external ID ${externalId}, ` +
        `date ID ${dateId}, roster type ${rosterType}.`
    );

    const start = Date.now();
    const handler = new QuestConvertPatientResponseHandlerDirect();
    await handler.convertQuestPatientResponse({
      externalId,
      dateId,
      rosterType,
    });
    const end = Date.now();
    console.log(`Conversion took ${elapsedTimeAsStr(start, end)}`);
  });

export default program;
