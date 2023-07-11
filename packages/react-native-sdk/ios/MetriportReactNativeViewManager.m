#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(MetriportWidgetManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(clientApiKey, NSString)
RCT_EXPORT_VIEW_PROPERTY(token, NSString)
RCT_EXPORT_VIEW_PROPERTY(sandbox, BOOL)
RCT_EXPORT_VIEW_PROPERTY(apiUrl, NSString?)
RCT_EXPORT_VIEW_PROPERTY(colorMode, NSString?)
RCT_EXPORT_VIEW_PROPERTY(customColor, NSString?)
RCT_EXPORT_VIEW_PROPERTY(providers, NSStringArray?)
RCT_EXPORT_VIEW_PROPERTY(url, NSString?)

@end