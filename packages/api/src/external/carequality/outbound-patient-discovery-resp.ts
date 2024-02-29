import { OutboundPatientDiscoveryRespTableEntry } from "@metriport/core/external/carequality/ihe-gateway/outbound-result";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface OutboundPatientDiscoveryResp
  extends BaseDomainCreate,
    OutboundPatientDiscoveryRespTableEntry {}
