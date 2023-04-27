
import SwiftUI
import UIKit
import MetriportSDK

@available(iOS 13.0, *)
@objc(MetriportConnectWidget) class MetriportConnectWidget : CDVPlugin {

  var hostingViewController = UIHostingController(rootView: WidgetView())

  @objc(show:)
  func show(command: CDVInvokedUrlCommand) {

    let clientApiKey = command.arguments[0] as? String;
    let token = command.arguments[1] as? String;
    let sandbox = command.arguments[2] as? Bool;
    let apiUrl = command.arguments[3] as? String;
    let colorMode = command.arguments[4] as? String;
    let customColor = command.arguments[5] as? String;
    let providers = command.arguments[6] as? [String];
    let url = command.arguments[7] as? String;

    lazy var hostingViewController = UIHostingController(rootView: WidgetView(
      clientApiKey: clientApiKey ?? "",
      token: token ?? "",
      sandbox: sandbox ?? false,
      apiUrl: apiUrl,
      colorMode: colorMode,
      customColor: customColor,
      providers: providers,
      url: url
    ));

    self.viewController.show(hostingViewController, sender: self);
    self.hostingViewController = hostingViewController;

  }
}


@available(iOS 13.0, *)
struct WidgetView : View {
    let webView: MetriportWidget

    init(clientApiKey: String = "", token: String = "", sandbox: Bool = false, apiUrl: String? = nil, colorMode: String? = nil, customColor: String? = nil, providers: [String]? = nil, url: String? = nil) {
        self.webView = MetriportWidget(
          healthStore: MetriportHealthStoreManager(clientApiKey: clientApiKey, sandbox: sandbox, apiUrl: apiUrl),
          token: token,
          sandbox: sandbox,
          colorMode: colorMode == "dark" ? ColorMode.dark : ColorMode.light,
          customColor: customColor,
          providers: providers,
          url: url
        )
    }

    var body: some View {
        VStack {
            webView
          HStack {
            Button(action: {
              self.webView.goBack()
            }){
              Image(systemName: "arrowtriangle.left.fill")
                                .font(.title)
                                .foregroundColor(.blue)
                                .padding()
            }
            Spacer()
            Button(action: {
              self.webView.refresh()
            }){
              Image(systemName: "arrow.clockwise.circle.fill")
                    .font(.title)
                    .foregroundColor(.blue)
                    .padding()
            }
            Spacer()
            Button(action: {
              self.webView.goForward()
            }){
              Image(systemName: "arrowtriangle.right.fill")
                    .font(.title)
                    .foregroundColor(.blue)
                    .padding()
            }
          }

        }
    }
}