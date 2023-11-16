import express from "express";
import * as https from "https";
import * as fs from "fs";

const app = express();

// Read the private key and the chain of certificates
const privateKey = fs.readFileSync("<path_to_your_private_key>/decrypted_private_key.key", "utf8");
const certificateChain = fs.readFileSync("<path_to_your_chain>/chained_no_root.pem", "utf8");

const credentials = { key: privateKey, cert: certificateChain };

// Create HTTPS server
https.createServer(credentials, app).listen(3000, () => {
  console.log("Express server listening on port 3000 with HTTPS");
});
