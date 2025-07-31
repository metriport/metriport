export interface QuestSendRosterCommand {
  sendRoster(): Promise<{ size: number }>;
}
