export const MLLP_DEFAULT_PORT = 2575;
export const HL7_NOTIFICATION_VPC_CIDR = "10.1.0.0/16";
export const PROBLEMATIC_IPSEC_CHARACTERS = "!@#$%^&*()_+-=[]{}|;:,.<>?~`'\"\\/";
export const MLLP_SERVER_CONTAINER_NAME = "MllpServer";

/**
 * These IPs are used to configure the NLB internal IPs for the MLLP server.
 * They need to each be unique to simplify the VPN routing configuration
 * for our third party partners.
 */
export const MLLP_SERVER_NLB_PROD_INTERNAL_IP_1 = "10.1.1.20";
export const MLLP_SERVER_NLB_PROD_INTERNAL_IP_2 = "10.1.1.21";
export const MLLP_SERVER_NLB_STAGING_INTERNAL_IP_1 = "10.1.1.22";
export const MLLP_SERVER_NLB_STAGING_INTERNAL_IP_2 = "10.1.1.23";
