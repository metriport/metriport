import express from "express";
import { json, Request, Response } from "express";
import fs from "fs";

const app = express();
const port = 8088;
app.use(json());

app.post("/", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }
  console.log(`[MOCK-SERVER] Received request: ${JSON.stringify(req.body, null, 2)}`);
  fs.writeFileSync("canvas-request.json", JSON.stringify(req.body, null, 2));
  res.send({ detail: "ok" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
