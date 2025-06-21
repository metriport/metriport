import { QuestSftpClient } from "../../client";
import { sftpActionHandlerBuilder } from "../../../sftp/command/sftp-action/sftp-action-factory";

export const buildSftpActionHandler = sftpActionHandlerBuilder(new QuestSftpClient());
