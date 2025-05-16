import axios from "axios";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler } from "../../../util";
const router = Router();

router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const queryParams = req.query;
    const code = queryParams.code?.toString() ?? "temo";
    const state = queryParams.state?.toString() ?? "temp";
    const clientId = "";
    const clientSecret = "";
    const data = {
      redirect_uri: "",
      code,
      code_verifier: state,
      grant_type: "authorization_code",
    };
    const baseUrl = "";
    try {
      const resp = await axios.post(baseUrl, new URLSearchParams(data).toString(), {
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      console.log(resp.data);
    } catch (error) {
      console.log("failed");
    }
    return res.redirect(302, "");
  })
);

export default router;
