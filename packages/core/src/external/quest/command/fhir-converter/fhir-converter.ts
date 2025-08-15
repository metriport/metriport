export interface QuestFhirConverterCommand {
  convertQuestResponseToFhir(): Promise<void>;
}
