import { SurescriptsReceiveAllRequest, SurescriptsSftpFile } from "../../types";

export interface SurescriptsReceiveAllHandler {
  receiveAllNewResponses({
    maxResponses,
  }: SurescriptsReceiveAllRequest): Promise<SurescriptsSftpFile[]>;
}
