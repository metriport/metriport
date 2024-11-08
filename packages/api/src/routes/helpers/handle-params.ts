import { NextFunction, Request, Response } from "express";

export const handleParams = (req: Request, res: Response, next: NextFunction): void => {
  req.aggregatedParams = {
    ...req.aggregatedParams,
    ...req.params,
  };

  next();
};
