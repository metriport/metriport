export default class Constants {
  static readonly TOKEN_PARAM = "token";
  static readonly DEMO_TOKEN = "demo";
  static readonly SANDBOX_PARAM = "sandbox";
  static readonly STAGING_PARAM = "staging";
  static readonly CLOUD_ENV = "production"; // NODE_ENV is production when not local
  static readonly COLOR_MODE_PARAM = "colorMode";
  static readonly CUSTOM_COLOR_PARAM = "customColor";
  static readonly SUCCESS_REDIRECT_URL_PARAM = "redirectUrl";
  static readonly FAILURE_REDIRECT_URL_PARAM = "failRedirectUrl";
  static readonly PROVIDERS_PARAM = "providers";
  static readonly APPLE_PARAM = "apple";
  static readonly BREAKPOINTS = {
    xs: "300px",
    sm: "500px",
    md: "768px",
    lg: "960px",
    xl: "1200px",
    "2xl": "1536px",
  };
  static readonly PRIMARY_COLOR = "#748df0";
  static readonly HOVER_COLOR = "#879ced";
}
