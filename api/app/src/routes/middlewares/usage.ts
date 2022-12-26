import { NextFunction, Request } from "express";
import { reportUsage as reportUsageCmd } from "../../command/usage/report-usage";
import { Util } from "../../shared/util";
import { getCxId, getUserId } from "../util";

const log = Util.log("USAGE");

/**
 * Adds a listener on Response close/finish, executing the logic on 'reportIt'.
 * Thanks to https://stackoverflow.com/questions/20175806/before-and-after-hooks-for-a-request-in-express-to-be-executed-before-any-req-a
 */
export const reportUsage = async (
  req: Request,
  res: any, // otherwise we get type error, those Response functions are not mapped on Typescript
  next: NextFunction
): Promise<void> => {
  function afterResponse() {
    res.removeListener("finish", afterResponse);
    res.removeListener("close", afterResponse);
    reportIt(req);
  }
  res.on("finish", afterResponse);
  res.on("close", afterResponse);
  next();
};

/**
 * Reports usage base on the the customer ID on the Request, property 'cxId', and
 * the customer's userId on the request params, 'userId'.
 */
const reportIt = async (req: Request): Promise<void> => {
  try {
    const cxId = getCxId(req);
    if (!cxId) {
      log(`Skipped, missing cxId`);
      return;
    }
    const cxUserId = getUserId(req);
    if (!cxUserId) {
      log(`Skipped, missing cxUserId (cxId ${cxId})`);
      return;
    }
    await reportUsageCmd({ cxId, cxUserId });
  } catch (err) {
    console.log(err);
    // intentionally failing silently
  }
};
