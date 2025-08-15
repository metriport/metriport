export interface QuestFhirConverterCommand {
  convertQuestResponseToFhirBundles(dateId: string): Promise<void>;
}
