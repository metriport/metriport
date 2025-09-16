import * as openpgp from "openpgp";
import { Config } from "../../util/config";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";

export async function getLahiePrivateKeyAndPassphrase(): Promise<{
  privateKeyArmored: string;
  passphrase: string;
}> {
  const privateKeyArmoredArn = Config.getLahieIngestionPrivateKeyArn();
  const passphrase = Config.getLahieIngestionPrivateKeyPassphraseArn();

  const privateKeyArmored = await getSecretValueOrFail(privateKeyArmoredArn, Config.getAWSRegion());
  //const passphrase = await getSecretValueOrFail(passphraseArn, Config.getAWSRegion());

  return { privateKeyArmored, passphrase };
}

/**
 * Decrypts GPG encrypted content using the private key and passphrase. Called within the sftp client before storing the file in S3.
 * @param content GPG encrypted content
 * @returns Decrypted content
 */
export async function decryptGpgBinaryWithPrivateKey(
  content: Buffer,
  privateKeyArmored: string,
  passphrase: string
): Promise<Buffer> {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const decryptionKey = await openpgp.decryptKey({ privateKey, passphrase });

  const message = await openpgp.readMessage({ binaryMessage: content });

  const { data } = await openpgp.decrypt({
    message,
    decryptionKeys: decryptionKey,
    format: "binary",
  });

  return Buffer.from(data as Uint8Array);
}
