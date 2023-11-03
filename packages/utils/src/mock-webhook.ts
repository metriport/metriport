import express, { Application, Request, Response } from "express";
import crypto from "crypto";

const app: Application = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

const secretKey = process.argv[2]; // Get the secret key from command line arguments

if (secretKey) {
  console.log(`Secret provided: ${secretKey}`);
} else {
  console.log("No secret key provided.");
}

app.post("/", (req: Request, res: Response) => {
  console.log(`BODY: ${JSON.stringify(req.body, undefined, 2)}`);

  if (secretKey && req.body.patients) {
    const receivedHash = crypto
      .createHmac("sha256", secretKey)
      .update(JSON.stringify(req.body.patients))
      .digest("hex");
    console.log(`Received hash: ${receivedHash}`);
    console.log(`Expected hash: ${req.body.meta.hmac}`);
    console.log(`Hashes are ${receivedHash === req.body.meta.hmac ? "the same" : "different"}`);
  }

  if (req.body.ping) {
    console.log(`Sending 200 | OK + 'pong' body param`);
    return res.status(200).send({ pong: req.body.ping });
  }
  console.log(`Sending 200 | OK`);
  res.sendStatus(200);
});

const port = 8088;
app.listen(port, "0.0.0.0", async () => {
  console.log(`[server]: Webhook mock server is running on port ${8088}`);
});
