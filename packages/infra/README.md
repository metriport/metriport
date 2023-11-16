# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## Creating a Certificate for IHE

1. **Download Certificate and Private Key**

   - Download your certificate (`ihe.staging.metriport.com.pem`) and private key (`PRIVATEKEY.key`) from their storage location, in this case, our Google Drive.

2. **Decrypt the Key**

   - Decrypt the key using OpenSSL. You will be prompted to enter the passcode stored in 1Password:
     ```
     openssl rsa -in PRIVATEKEY.key -out decrypted_private_key.key
     ```

3. **Download the Production/Validation Bundle**

   - Download the Production / Validation bundle from the Sequoia Project:
     [Sequoia Project Trust Chains](https://directtrust.zohodesk.com/portal/en/kb/articles/installing-sequoia-project-trust-chains)
   - Run the following OpenSSL command:
     ```
     openssl pkcs7 -in sequoiaProject"<Val_or_Prod">TrustBundle.p7b -print_certs -out SubCA2.pem
     ```

4. **Extract Intermediate Certificates**

   - There will be several different Intermediate Certs inside the file. _First_, identify the cert that corresponds to the intermediate cert that `ihe.staging.metriport.com.pem` points to. You can check this by pasting the cert into [SSL Checker](https://tools.keycdn.com/ssl). Choose the correct cert and store it in `intermediate_cert.pem`:
     ```
     -----BEGIN CERTIFICATE-----
     ABCDEFG...
     -----END CERTIFICATE-----
     ```

5. **Select Root Certificate**

   - _Second_, examine the intermediate cert you chose and note the issuer listed for it. Then select that cert and store it into `root_cert.pem`.

6. **Validate Issued Certificate**

   - Validate that your issued cert is good by running:
     ```
     cat ihe.staging.metriport.com.pem intermediate_cert.pem root_cert.pem > chain.pem
     ```
   - Copy and paste that into [SSL Checker](https://tools.keycdn.com/ssl) to validate that the cert chain is valid.

7. **Alternative Certificate Verification**

   - Alternatively, you can verify your certs by concatenating your cert and the intermediate cert into `chained_no_root.pe`m:
     ```
     cat ihe.staging.metriport.com.pem intermediate_cert.pem > chained_no_root.pem
     ```
   - Fill in the your path to `privateKey` and `certificateChain` in `test/run-cert.ts` and then run:
     ```
     npm run run-cert
     ```
   - Then, use OpenSSL to connect to your server:
     ```
     openssl s_client -connect localhost:3000 -servername localhost -root_cert.pem
     ```
   - If you see "Verify return code: 0 (ok)", then you know the cert is valid.

8. **Import Certificate into AWS ACM**
   - Finally, import the certificate into AWS ACM with the following command:
     ```
     aws acm import-certificate --region us-east-2 \
       --certificate fileb://ihe.staging.metriport.com.pem \
       --private-key fileb://decrypted_private_key.key \
       --certificate-chain fileb://intermediate_cert.pem
     ```
