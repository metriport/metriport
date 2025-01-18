import { Request, Response } from "express";
import Router from "express-promise-router";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler } from "../util";
import status from "http-status";
import { networkGetSchema } from "./schemas/network";
import { NetworkDTO } from "./dtos/networkDTO";
import { USState } from "@metriport/shared";

const router = Router();

router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const params = networkGetSchema.parse(req.query);
    const networks: NetworkDTO[] = [
      {
        id: "1",
        eTag: "1",
        name: "Network 1",
        oid: "1",
        zip: "12345",
        state: USState.CA,
        managingOrg: "Org 1",
        managingOrgOid: "1",
      },
      {
        id: "2",
        eTag: "2",
        name: "Network 2",
        oid: "2",
        zip: "12345",
        state: USState.NJ,
        managingOrg: "Org 2",
        managingOrgOid: "2",
      },
      {
        id: "3",
        eTag: "3",
        name: "Network 3",
        oid: "3",
        zip: "12345",
        state: USState.FL,
        managingOrg: "Org 3",
        managingOrgOid: "3",
      },
    ];

    return res.status(status.OK).json({ networks, params });
  })
);

export default router;
