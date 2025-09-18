import * as _ from "lodash";

/**
 * IF YOU CHANGE THIS, YOU MUST CHANGE THE EXPOSED PORTS IN THE MLLP_SERVER'S DOCKERFILE
 */
export const SUPPORTED_MLLP_SERVER_PORTS = _.range(2575, 2585);
export const MLLP_SERVER_FIRST_VALID_PORT = SUPPORTED_MLLP_SERVER_PORTS[0] as number;
export const MLLP_SERVER_LAST_VALID_PORT = SUPPORTED_MLLP_SERVER_PORTS[
  SUPPORTED_MLLP_SERVER_PORTS.length - 1
] as number;
export function isPccConnection(hieName: string): boolean {
  return hieName === "HieTexasPcc";
}
