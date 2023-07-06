export class NoTokenError extends Error {
  title: string;
  link: string;
  icon?: string;
  static DEFAULT_TITLE = "Missing Connect Token";

  constructor(message?: string, link?: string, icon?: string) {
    super(
      message
        ? message
        : `Missing 'token' query parameter! To learn more, go to the Connect Widget overview in our documentation.`
    );
    this.link = link
      ? link
      : "https://docs.metriport.com/devices-api/getting-started/connect-widget#token";
    this.title = NoTokenError.DEFAULT_TITLE;
    this.icon = icon;
  }
}

export class DemoTokenError extends Error {
  title: string;
  link: string;
  icon?: string;
  static DEFAULT_TITLE = "Demo Mode";
  static DEFAULT_MSG =
    "The Connect Widget is running in demo mode! You will not be able to connect providers unless you acquire a valid connect token. See Create Connect Token documentation for reference.";

  constructor(message?: string, link?: string, icon?: string) {
    super(message ? message : DemoTokenError.DEFAULT_MSG);
    this.link = link
      ? link
      : "https://docs.metriport.com/devices-api/api-reference/user/create-connect-token";
    this.title = DemoTokenError.DEFAULT_TITLE;
    this.icon = icon;
  }
}

export class InvalidTokenError extends Error {
  title: string;
  link: string;
  icon?: string;
  static DEFAULT_TITLE = "Invalid Connect Token";

  constructor(message?: string, link?: string, icon?: string) {
    super(
      message
        ? message
        : "Your Connect Token is invalid. See Create Connect Token documentation for reference."
    );
    this.link = link
      ? link
      : "https://docs.metriport.com/devices-api/api-reference/user/create-connect-token";
    this.title = InvalidTokenError.DEFAULT_TITLE;
    this.icon = icon;
  }
}
