export interface QuestFhirConverterCommand {
  convertQuestResponseToFhirBundles(responseFileName: string): Promise<void>;
}
