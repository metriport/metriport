export type EhexGatewayProps = {
  vpcId: string;
  certArn: string;
  ownershipCertArn?: string;
  trustStoreBucketName: string;
  trustStoreKey: string;
  subdomain: string;
  snsTopicArn?: string;
};
