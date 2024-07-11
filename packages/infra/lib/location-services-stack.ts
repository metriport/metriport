import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as ALS from "aws-cdk-lib/aws-location";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";

interface LocationServicesStackProps extends StackProps {
  config: EnvConfig;
}

export class LocationServicesStack extends Stack {
  constructor(scope: Construct, id: string, props: LocationServicesStackProps) {
    super(scope, id, props);
    //-------------------------------------------
    // API Gateway
    //-------------------------------------------
    if (!props.config.locationService) {
      return;
    }
    const placeIndex = new ALS.CfnPlaceIndex(this, props.config.locationService.placeIndexName, {
      dataSource: "Esri",
      indexName: props.config.locationService.placeIndexName,
    });

    //-------------------------------------------
    // Output
    //-------------------------------------------
    new CfnOutput(this, "PlaceIndexName", {
      description: "Place index name",
      value: placeIndex.indexName,
    });
  }
}
