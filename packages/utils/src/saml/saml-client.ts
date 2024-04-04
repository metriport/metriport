import axios from "axios";
import fs from "fs";
import https from "https";

export async function sendSignedXml(
  signedXml: string,
  url: string,
  certChain: string,
  privateKey: string
): Promise<string> {
  const certFilePath = "./tempCert.pem";
  const keyFilePath = "./tempKey.pem";
  fs.writeFileSync(certFilePath, certChain);
  fs.writeFileSync(keyFilePath, privateKey);

  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
      cert: fs.readFileSync(certFilePath),
      key: fs.readFileSync(keyFilePath),
    });

    const response = await axios.post(url, signedXml, {
      headers: {
        "Content-Type": "application/soap+xml;charset=UTF-8",
        "Cache-Control": "no-cache",
      },
      httpsAgent: agent,
    });

    return response.data;
  } finally {
    fs.unlinkSync(certFilePath);
    fs.unlinkSync(keyFilePath);
  }
}
