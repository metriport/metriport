import express from "express";
import * as fs from "fs";
import * as https from "https";

/**
 * Script to test the Certificate issued by Carequality.
 *
 * Execute the steps 1-4 laid out in the "Creating a Certificate for IHE" section from
 * infra/README.md and:
 * - Concatenate your cert and the intermediate cert into `chained_no_root.pem`:
 *   $> cat <your_domain_name>.pem intermediate_cert.pem > chained_no_root.pem
 * - Set the path to the files below
 *
 * Run with ts-node src/carequality/cq-cert-checker.ts
 */

const privateKey = fs.readFileSync("<path_to_your_private_key>/decrypted_private_key.key", "utf8");
const certificateChain = fs.readFileSync("<path_to_your_chain>/chained_no_root.pem", "utf8");

const credentials = { key: privateKey, cert: certificateChain };

// Create HTTPS server
const app = express();
https.createServer(credentials, app).listen(3000, () => {
  console.log("Express server listening on port 3000 with HTTPS");
});
