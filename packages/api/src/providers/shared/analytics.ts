import Provider from "../provider";

export type ExtraType = Record<string, string | undefined> & {
  action: keyof Provider;
};

/**
 * DAPI only!
 */
export async function executeAndReportAnalytics<R>(fnToExecute: () => Promise<R>): Promise<R> {
  const resp = await fnToExecute();
  return resp;
}
