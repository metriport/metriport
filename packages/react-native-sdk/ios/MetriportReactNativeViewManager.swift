import MetriportSDK
import SwiftUI

@objc(MetriportWidgetManager)
class MetriportWidgetManager: RCTViewManager {

  override func view() -> (MetriportWidgetView) {
    return MetriportWidgetView()
  }

  @objc override static func requiresMainQueueSetup() -> Bool {
    return false
  }
}

class MetriportWidgetView : UIView {
  private var vc = UIHostingController(rootView: WidgetView())


  @objc var clientApiKey: String = "" {
    didSet {
      vc.rootView.clientApiKey = clientApiKey
    }
  }
  @objc var token: String = "" {
    didSet {
      vc.rootView.token = token
    }
  }
  @objc var sandbox: Bool = false {
    didSet {
      vc.rootView.sandbox = sandbox
    }
  }
  @objc var apiUrl: String? = nil {
    didSet {
      vc.rootView.apiUrl = apiUrl
    }
  }
  @objc var colorMode: String? = nil {
    didSet {
      vc.rootView.colorModeText = colorMode
    }
  }
  @objc var customColor: String? = nil {
    didSet {
      vc.rootView.customColor = customColor
    }
  }
  @objc var providers: [String]? = nil {
    didSet {
      vc.rootView.providers = providers
    }
  }
  @objc var url: String? = nil {
    didSet {
      vc.rootView.url = url
    }
  }


  override init(frame: CGRect) {
    super.init(frame: frame)
    createSubViews()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    createSubViews()
  }

  private func createSubViews() {
    self.addSubview(vc.view)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    vc.view.frame = self.bounds
  }
}

struct WidgetView : View {
    var clientApiKey: String = ""
    var token: String = ""
    var sandbox: Bool = false
    var apiUrl: String? = nil
    var colorModeText: String? = nil
    var customColor: String? = nil
    var providers: [String]? = nil
    var url: String? = nil

    var healthStore: MetriportHealthStoreManager {
      MetriportHealthStoreManager(clientApiKey: clientApiKey, sandbox: sandbox, apiUrl: apiUrl);
    }

    var body: some View {
        
        VStack {
            MetriportWidget(
              healthStore: healthStore,
              token: token,
              sandbox: sandbox,
              colorMode: colorModeText == "dark" ? ColorMode.dark : ColorMode.light,
              customColor: customColor,
              providers: providers,
              url: url
            )
        }
    }
}
