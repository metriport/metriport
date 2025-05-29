export type ProcessSynchronizeRequest = {
  connect: boolean;
  dryRun?: boolean;
  surescriptsDirectory?: "to_surescripts" | "from_surescripts";
  surescriptsFile?: string | undefined;
};

export interface SurescriptsSynchronizeHandler {
  processSynchronize(request: ProcessSynchronizeRequest): Promise<void>;
}
