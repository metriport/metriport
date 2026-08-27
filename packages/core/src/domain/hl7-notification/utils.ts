import { FLHIE_HIE_NAME, HIE_TEXAS_PCC } from "@metriport/shared/external/hl7v2/constants";

/**
 * If you change this, you must change the exposed ports in packages/mllp-server/Dockerfile
 */
export const OLD_MLLP_SERVER_PORT = 2575;
export const SUPPORTED_MLLP_SERVER_PORTS = [2575, 2576];
export const MLLP_SERVER_FIRST_VALID_PORT = SUPPORTED_MLLP_SERVER_PORTS[0] as number;
export const MLLP_SERVER_LAST_VALID_PORT = SUPPORTED_MLLP_SERVER_PORTS[
  SUPPORTED_MLLP_SERVER_PORTS.length - 1
] as number;

/**
 * All data from PCC connections is sent to the MLLP server over the HieTexasPcc tunnel.
 * Multiple PCC HIEs (e.g., TEXASPCC, FLHIE) share the same tunnel and are differentiated by port.
 */
export const PCC_CONNECTION_HIE_NAMES: readonly string[] = [HIE_TEXAS_PCC, FLHIE_HIE_NAME];

/**
 * @param hieName
 * @returns true if the data is from a PCC connection, false otherwise
 */
export function isPccConnection(hieName: string): boolean {
  return PCC_CONNECTION_HIE_NAMES.includes(hieName);
}
export function getPccSourceHieNameByLocalPort(port: number): string {
  if (port === 2575) {
    return HIE_TEXAS_PCC;
  } else if (port === 2576) {
    return FLHIE_HIE_NAME;
  }
  throw new Error(`No mapping declared for specified port: ${port}`);
}
