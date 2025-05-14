import { Request, Response } from "express";
import Router from "express-promise-router";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler } from "../../../util";
import crypto from "crypto";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
//import axios from "axios";

const router = Router();

/**
 * POST /internal/ehr/elation/patient/appointments
 *
 * Fetches appointments in the future and creates all patients not already existing
 * @returns 200 OK
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const queryParams = req.query;
    const iss = queryParams.iss?.toString() ?? "temo";
    const launch = queryParams.launch?.toString() ?? "temp";
    const state = uuidv7();
    const code_challenge = crypto.createHash("sha256").update(state).digest("base64url");
    const code_challenge_method = "S256";
    const redirectParams = new URLSearchParams();
    redirectParams.append("response_type", "code");
    redirectParams.append("scope", "launch user/Patient.read");
    redirectParams.append("client_id", "");
    redirectParams.append(
      "redirect_uri",
      "https://922f9bdccddc.ngrok.app/internal/ehr/eclinicalworks/oauth2"
    );
    redirectParams.append("aud", iss);
    redirectParams.append("state", state);
    redirectParams.append("launch", launch);
    redirectParams.append("code_challenge", code_challenge);
    redirectParams.append("code_challenge_method", code_challenge_method);
    const baseUrl = "https://staging-oauthserver.ecwcloud.com/oauth/oauth2/authorize";
    const redirectUrl = `${baseUrl}?${redirectParams.toString()}`;
    console.log(redirectUrl);

    return res.redirect(302, redirectUrl);
  })
);

export default router;
