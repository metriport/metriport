#import "MetriportConfiguration.h"
#import <React/RCTBridgeModule.h>

@import MetriportSDK;

@implementation MetriportConfiguration

+ (void)checkBackgroundUpdates {
  [MetriportClient checkBackgroundUpdates];
}

@end
