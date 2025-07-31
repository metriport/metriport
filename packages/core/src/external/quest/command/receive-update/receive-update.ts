import { QuestConversionBundle } from "../../types";

export interface QuestReceiveUpdateCommand {
  receiveAllUpdates(): Promise<QuestConversionBundle[]>;
}
