import { Carequality } from "@metriport/carequality-sdk/client/carequality";
import { normalizeOid } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import {
  CQDirectoryOrg,
  createCQOrganization,
} from "../../command/medical/cq-directory/create-cq-organization";
import {
  getCoordinates,
  getState,
  getUrls,
} from "../../command/medical/cq-directory/parse-cq-organization";
import { Config } from "../../shared/config";
import { asyncHandler } from "../util";

const apiKey = Config.getCQApiKey();
const apiMode = Config.getEnvType();

dayjs.extend(duration);

const router = Router();

router.post(
  "/test",
  asyncHandler(async (req: Request, res: Response) => {
    const testOrg = {
      oid: "1.1.1.11123",
      urlXCPD: "https://api.app.com/1",
      urlDQ: "https//api.app.com/2",
      urlDR: "https//api.app.com/3",
      name: "Test Org",
      latitude: "40.689247",
      longitude: "-74.044502",
      state: "NY",
    };

    const resp = await createCQOrganization(testOrg);
    return res.status(httpStatus.OK).json(resp);
  })
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cq = new Carequality(apiKey, apiMode);
    const resp = await cq.listAllOrganizations();
    const orgs = resp.organizations.flatMap(org => {
      const orgOid = org?.identifier?.value?.value;
      if (!orgOid) return [];

      const url = getUrls(org?.contained);
      if (!url?.urlXCPD) return [];

      const oid = normalizeOid(org?.identifier?.value?.value);
      const coordinates = getCoordinates(org?.address);

      const state = getState(org.address);
      const orgData: CQDirectoryOrg = {
        oid,
        name: org.name?.value ?? undefined,
        urlXCPD: url.urlXCPD,
        urlDQ: url.urlDQ,
        urlDR: url.urlDR,
        latitude: coordinates?.latitude ?? undefined,
        longitude: coordinates?.longitude ?? undefined,
        data: {
          ...org,
        },
        state,
      };
      return orgData;
    });

    const response = {
      totalFetched: resp.count,
      added: 0,
      updated: 0,
    };
    for (const org of orgs) {
      const dbResponse = await createCQOrganization(org);
      response.added += dbResponse.added ?? 0;
      response.updated += dbResponse.updated ?? 0;
    }

    return res.status(httpStatus.OK).json(response);
  })
);

export default router;
