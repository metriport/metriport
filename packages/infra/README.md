# Metriport Infrastructure as Code (IaC)

Metriport's Infrastructure as Code (IaC) is an AWS CDK project that uses TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## IHE Stack

### Creating a Certificate for IHE

1. **Download Certificate and Private Key**

   - Download your certificate (for example, `ihe.staging.metriport.com.pem`) and private key (for example, `PRIVATEKEY.key`).

2. **Decrypt the Key**

   - Decrypt the key using OpenSSL. You will be prompted to enter the pascode.
     ```
     openssl rsa -in PRIVATEKEY.key -out decrypted_private_key.key
     ```

3. **Download the Production/Validation Bundle**

   - Download the Production / Validation bundle from the Sequoia Project:
     [Sequoia Project Trust Chains](https://directtrust.zohodesk.com/portal/en/kb/articles/installing-sequoia-project-trust-chains)
   - Run the following OpenSSL command to convert the file from a pkcs7 file to a pem file:
     ```
     openssl pkcs7 -in sequoiaProject"<Val_or_Prod">TrustBundle.p7b -print_certs -out SubCA2.pem
     ```

4. **Extract Certificates**

   - There will be several different Intermediate Certs inside the file.
   - _First_, identify the cert that corresponds to the intermediate cert that `<your_domain_name>.pem` points to. You can check this by pasting the cert into [SSL Checker](https://tools.keycdn.com/ssl). Choose the correct cert and store it in `intermediate_cert.pem`. The format should look like this:

     ```
     -----BEGIN CERTIFICATE-----
     ABCDEFGH...
     -----END CERTIFICATE-----
     ```

   - _Second_, examine the intermediate cert you chose and note the issuer listed for it. Then select that cert and store it into `root_cert.pem`.

5. **Validate Issued Certificate**

   - Concatenate your certs and validate that it is good by copy and pasting it into [SSL Checker](https://tools.keycdn.com/ssl):
     ```
     cat <your_domain_name>.pem intermediate_cert.pem root_cert.pem > chain.pem
     ```
   - When you concatenate your certs, make sure they look like this:

     ```
     -----BEGIN CERTIFICATE-----
     ...
     -----END CERTIFICATE-----
     -----BEGIN CERTIFICATE-----
     ...
     -----END CERTIFICATE-----
     ```

     and that they don't look like this:

     ```
     -----BEGIN CERTIFICATE-----
     ...
     -----END CERTIFICATE----------BEGIN CERTIFICATE-----
     ...
     -----END CERTIFICATE-----
     ```

   - _Alternatively_, you can verify your certs by concatenating your cert and the intermediate cert into `chained_no_root.pe`m:
     ```
     cat <your_domain_name>.pem intermediate_cert.pem > chained_no_root.pem
     ```
   - Fill in the your path to `privateKey` and `certificateChain` in `test/run-cert.ts` and then run:
     ```
     npm run run-cert
     ```
   - Then, use OpenSSL to connect to your server:
     ```
     openssl s_client -connect localhost:3000 -servername localhost --CAfile root_cert.pem
     ```
   - If you see `Verify return code: 0 (ok)``, then you know the cert is valid.

6. **Import Certificate into AWS ACM**
   - Finally, you are ready to import the certificate into AWS ACM with the following command:
     ```
     aws acm import-certificate --region <your-aws-region> \
       --certificate fileb://<your_domain_name>.pem \
       --private-key fileb://decrypted_private_key.key \
       --certificate-chain fileb://intermediate_cert.pem
     ```

### Local Development

If you need to deploy the IHE Stack from the local environment/computer, you'll need

1. A `.env-ihe` file on the `packages/infra` folder, containing the ENV vars CDK sends to Docker:
   - `STOREPASS`
   - `KEYSTOREPASS`
   - `LICENSE_KEY`
2. Pass `LOCAL=true` as an env var to the `cdk` CLI command, so it loads the `.env-ihe` file into
   environment variables:

   ```shell
   $ LOCAL=true cdk diff -c env=<environment> IHEStack
   ```
