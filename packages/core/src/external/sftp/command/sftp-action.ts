import { SftpAction, SftpActionResult } from "../types";

export interface SftpActionHandler<A extends SftpAction> {
  executeAction(action: A): Promise<{ result?: SftpActionResult<A>; error?: Error }>;
}
