import { NextFunction, Request } from "express";
import { reportUsage as reportUsageCmd } from "../../command/usage/report-usage";
import { Product } from "../../domain/product";
import { isHttpOK } from "../../shared/http";
import { Util } from "../../shared/util";
import { getUserIdFrom } from "../schemas/user-id";
import { getCxId } from "../util";

const log = Util.log("USAGE");

/**
 * Adds a listener on Response close/finish, executing the logic on 'reportIt'.
 * Thanks to https://stackoverflow.com/questions/20175806/before-and-after-hooks-for-a-request-in-express-to-be-executed-before-any-req-a
 */
export const reportUsage = (
  product: Product,
  getEntityIdFn: (req: Request) => string | undefined
) => {
  return async (
    req: Request,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res: any, // otherwise we get type error, those Response functions are not mapped on Typescript
    next: NextFunction
  ): Promise<void> => {
    function afterResponse() {
      res.removeListener("finish", afterResponse);
      res.removeListener("close", afterResponse);
      if (isHttpOK(res.statusCode)) reportIt(req, product, getEntityIdFn(req));
    }
    res.on("finish", afterResponse);
    res.on("close", afterResponse);
    next();
  };
};

/**
 * Reports usage base on the the customer ID on the Request, property 'cxId', and
 * the customer's userId on the request params, 'userId'.
 */
export const reportDeviceUsage = reportUsage(Product.devices, getDevicesEntityId);

const reportIt = async (
  req: Request,
  product: Product,
  entityId: string | undefined
): Promise<void> => {
  const cxId = getCxId(req);
  if (!cxId) {
    log(`Skipped, missing cxId`);
    return;
  }
  if (!entityId) {
    log(`Skipped, missing entityId`);
    return;
  }
  reportUsageCmd({ cxId, entityId, product });
};

function getDevicesEntityId(req: Request): string | undefined {
  return getUserIdFrom("params", req).optional() ?? getUserIdFrom("query", req).optional();
}
