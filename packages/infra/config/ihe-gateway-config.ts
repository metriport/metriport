export type IHEGatewayProps = {
  vpcId: string;
  certArn: string;
  ownershipCertArn?: string;
  trustStoreBucketName: string;
  trustStoreKey: string;
  subdomain: string; // Subdomain for IHE integrations
  snsTopicArn?: string;
};
