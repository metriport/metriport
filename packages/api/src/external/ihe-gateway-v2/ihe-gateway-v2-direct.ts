import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { IHEGatewayV2 } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";
import { createSignSendProcessXCPDRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-logic";
import { emptyFunction } from "@metriport/shared";
import { createOutboundPatientDiscoveryResp } from "../carequality/command/outbound-resp/create-outbound-patient-discovery-resp";
import { processPostRespOutboundPatientDiscoveryResps } from "../carequality/process-subsequent-outbound-patient-discovery-resps";
import { getPDResultStatus } from "../carequality/ihe-result";
import { Config } from "../../shared/config";

export class IHEGatewayV2Direct extends IHEGatewayV2 {
  constructor() {
    super();
  }
  async startPatientDiscoveryGatewayV2({
    pdRequestGatewayV2,
    patientId,
    cxId,
  }: {
    pdRequestGatewayV2: OutboundPatientDiscoveryReq;
    patientId: string;
    cxId: string;
  }): Promise<void> {
    const privateKeySecretName = Config.getCQOrgPrivateKey();
    const privateKeyPasswordSecretName = Config.getCQOrgPrivateKeyPassword();
    const publicCertSecretName = Config.getCQOrgCertificate();
    const certChainSecretName = Config.getCQOrgCertificateIntermediate();

    const privateKey = await getSecret(privateKeySecretName);
    const privateKeyPassword = await getSecret(privateKeyPasswordSecretName);
    const publicCert = await getSecret(publicCertSecretName);
    const certChain = await getSecret(certChainSecretName);
    if (
      !privateKey ||
      typeof privateKey !== "string" ||
      !privateKeyPassword ||
      typeof privateKeyPassword !== "string" ||
      !publicCert ||
      typeof publicCert !== "string" ||
      !certChain ||
      typeof certChain !== "string"
    ) {
      throw new Error("Failed to get secrets or one of the secrets is not a string.");
    }

    const results = await createSignSendProcessXCPDRequest({
      xcpdRequest: pdRequestGatewayV2,
      publicCert,
      privateKey,
      privateKeyPassword,
      certChain,
      patientId,
      cxId,
    });

    for (const result of results) {
      await createOutboundPatientDiscoveryResp({
        id: uuidv7(),
        requestId: result.id,
        patientId: result.patientId,
        status: getPDResultStatus(result),
        response: result,
      });
      if (result.patientId && result.cxId) {
        processPostRespOutboundPatientDiscoveryResps({
          requestId: result.id,
          patientId: result.patientId,
          cxId: result.cxId,
        }).catch(emptyFunction);
      }
    }
  }
}
