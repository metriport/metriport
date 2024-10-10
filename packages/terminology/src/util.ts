import { NextFunction, Request, Response } from "express";

export function asyncHandler(
  f: (
    req: Request,
    res: Response,
    next: NextFunction
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<Response<any, Record<string, any>> | void>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await f(req, res, next);
    } catch (err) {
      console.log(`${JSON.stringify(err)}`);
      next(err);
    }
  };
}
