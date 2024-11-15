import { Request, Response } from "express";

export function deprecateAllRoutes(req: Request, res: Response) {
  return res.status(404).json({ message: "This route is no longer available." });
}
