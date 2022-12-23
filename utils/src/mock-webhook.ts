import express, { Application, Request, Response } from "express";

const app: Application = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post("/", (req: Request, res: Response) => {
  console.log(`BODY: ${JSON.stringify(req.body, undefined, 2)}`);
  if (req.body.ping) {
    console.log(`Sending 200 | OK`);
    return res.status(200).send({ pong: req.body.ping });
  }
  console.log(`Sending 400 | BadRequest`);
  res.status(400).send("Missing 'ping' body param");
});

const port = 8088;
app.listen(port, "0.0.0.0", async () => {
  console.log(`[server]: Webhook mock server is running on port ${8088}`);
});
