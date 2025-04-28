import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { handleParams } from "../helpers/handle-params";
import { asyncHandler } from "../util";
import crypto from "crypto";

import axios, { AxiosError } from "axios";

const router = Router();

const clientId = "TODO";
const clientSecret = "TODO";
const redirectUri = "TODO";
const codeVerifier = "TODO";

/**
 * GET /ehr/oauth2/eclinicalworks
 */
router.get(
  "/eclinicalworks",
  handleParams,
  asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code;
    const data = {
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      code: code,
    };
    const response = await axios.post(
      "https://oauthserver.eclinicalworks.com/oauth/oauth2/token",
      data,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${data.client_id}:${data.client_secret}`).toString(
            "base64"
          )}`,
        },
      }
    );
    const token = response.data.access_token;
    const patientId = response.data.patient;
    try {
      const patient = await axios.get(
        `https://fhir4.healow.com/fhir/r4/JAFJCD/Patient/${patientId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(patient.data);
      return res.status(httpStatus.OK).json(patient.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        console.log(error.response?.data);
        return res.status(httpStatus.BAD_REQUEST).json({ error: "Failed to fetch patient data" });
      }
      return res.status(httpStatus.BAD_REQUEST).json({ error: "Failed to fetch patient data" });
    }
  })
);

/**
 * GET /ehr/oauth2/eclinicalworks
 */
router.get(
  "/eclinicalworks/url",
  handleParams,
  asyncHandler(async (req: Request, res: Response) => {
    const data = {
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: crypto.createHash("sha256").update(codeVerifier).digest("base64url"),
      code_challenge_method: "S256",
      scope: "launch patient/Patient.read",
      state: "test",
      aud: "https://fhir4.healow.com/fhir/r4/JAFJCD",
      practice_code: "JAFJCD",
    };
    return res.redirect(
      `https://oauthserver.eclinicalworks.com/oauth/oauth2/authorize?${new URLSearchParams(
        data
      ).toString()}`
    );
  })
);

export default router;
