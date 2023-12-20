import * as dotenv from "dotenv";
import { processIncomingRequest } from "@metriport/core/external/carequality/process-incoming-iti-55";

dotenv.config();

import express, { Application, Request, Response } from "express";

const app: Application = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

app.post("/iti55/v1", async (req: Request, res: Response) => {
  try {
    const response = await processIncomingRequest(req.body);
    res.set("Content-Type", "application/json; charset=utf-8");
    res.send({ response });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
