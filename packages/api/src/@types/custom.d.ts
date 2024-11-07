/* eslint-disable @typescript-eslint/no-unused-vars */
namespace Express {
  interface Request {
    id: string | undefined;
    cxId: string | undefined;
    aggregatedParams: Record<string, string> | undefined;
    patient: any | undefined; //eslint-disable-line @typescript-eslint/no-explicit-any
    facility: any | undefined; //eslint-disable-line @typescript-eslint/no-explicit-any
    email: string | undefined;
  }
}
