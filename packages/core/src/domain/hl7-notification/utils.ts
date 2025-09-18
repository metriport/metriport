import * as _ from "lodash";

/**
 * IF YOU CHANGE THIS, YOU MUST CHANGE THE EXPOSED PORTS IN THE MLLP_SERVER'S DOCKERFILE
 */
export const SUPPORTED_MLLP_SERVER_PORTS = _.range(2575, 2585);
export const MLLP_SERVER_FIRST_VALID_PORT = SUPPORTED_MLLP_SERVER_PORTS[0] as number;
export const MLLP_SERVER_LAST_VALID_PORT = SUPPORTED_MLLP_SERVER_PORTS[
  SUPPORTED_MLLP_SERVER_PORTS.length - 1
] as number;

/**
 * All data from PCC connections is sent to the MLLP server over the HieTexasPcc tunnel.
 * @param hieName
 * @returns true if the data is from a PCC connection, false otherwise
 */
export function isDataFromPccConnection(hieName: string): boolean {
  return hieName === "HieTexasPcc";
}
export function getPccSourceHieNameByLocalPort(port: number): string {
  if (port === 2575) {
    return "HieTexasPcc";
  } else if (port === 2576) {
    return "Flhie";
  }
  throw new Error(`No mapping declared for specified port: ${port}`);
}
