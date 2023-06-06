export class NoTokenError extends Error {
  title: string;
  link: string;
  icon?: string;

  constructor(message: string, link?: string, icon?: string) {
    super(message);
    this.link = link
      ? link
      : "https://docs.metriport.com/devices-api/getting-started/connect-widget#token";
    this.title = "Missing Connect Token";
    this.icon = icon;
  }
}

export class DemoTokenError extends Error {
  title: string;
  link: string;
  icon?: string;

  constructor(message: string, link?: string, icon?: string) {
    super(message);
    this.link = link
      ? link
      : "https://docs.metriport.com/devices-api/api-reference/user/create-connect-token";
    this.title = "Demo Mode";
    this.icon = icon;
  }
}

export class InvalidTokenError extends Error {
  title: string;
  link: string;
  icon?: string;

  constructor(message: string, link?: string, icon?: string) {
    super(message);
    this.link = link
      ? link
      : "https://docs.metriport.com/devices-api/api-reference/user/create-connect-token";
    this.title = "Invalid Connect Token";
    this.icon = icon;
  }
}
