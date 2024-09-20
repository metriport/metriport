import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import axios from "axios";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";
import { getFromQueryOrFail } from "../../util";

const router = Router();

function createDataParams(data: { [key: string]: string }): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

/**
 * GET /ehr/athenahealth/patient/:id
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of AthenaHealth Patient.
 * @returns Metriport Patient if found.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const code = getFromQueryOrFail("code", req);
    const canvasApi = axios.create({ baseURL: "http://home-app-web:8000", timeout: 5000 });
    const data = {
      grant_type: "authorization_code",
      code,
      redirect_uri: "http://localhost:8080/ehr/canvas/oauth2",
      client_id: "FILL", // ID from `select client_id from Oauth_canvasoauthapplication;`
      client_secret: "FILL", // SECRET from `select client_secret from Oauth_canvasoauthapplication;`
    };
    const dataParams = createDataParams(data);
    const resp = await canvasApi.post("/auth/token/", dataParams, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return res
      .header({
        Location: `http://localhost:3020/canvas/app#access_token=${resp.data["access_token"]}&patient=FILL`, // ID from `select key from api_patient;`
      })
      .sendStatus(httpStatus.FOUND);
  })
);

export default router;
