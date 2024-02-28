import { Config } from "../../shared/config";
import { buildXmlStringFromTemplate } from "./organization-template";
import { CQOrgDetails, CQOrgUrls, cqOrgUrlsSchema } from "./shared";

const cqOrgUrlsString = Config.getCQOrgUrls();

/**
 * Represents an organization to be registered / updated in the Carequality directory.
 */
export class CQOrganization {
  static urls = cqOrgUrlsString ? cqOrgUrlsSchema.parse(JSON.parse(cqOrgUrlsString)) : {};
  xmlString: string | undefined;

  constructor(
    public name: string,
    public oid: string,
    public addressLine1: string,
    public city: string,
    public state: string,
    public postalCode: string,
    public lat: string,
    public lon: string,
    public contactName: string,
    public phone: string,
    public email: string,
    public role: "Implementer" | "Connection",
    public hostOrgOID?: string,
    public urlXCPD?: string,
    public urlDQ?: string,
    public urlDR?: string
  ) {}

  static fromDetails(orgDetails: CQOrgDetails): CQOrganization {
    const organization = new CQOrganization(
      orgDetails.name,
      orgDetails.oid,
      orgDetails.addressLine1,
      orgDetails.city,
      orgDetails.state,
      orgDetails.postalCode,
      orgDetails.lat,
      orgDetails.lon,
      orgDetails.contactName,
      orgDetails.phone,
      orgDetails.email,
      orgDetails.role,
      orgDetails.hostOrgOID
    );

    this.addUrls(organization);
    return organization;
  }

  static addUrls(organization: CQOrganization) {
    organization.urlXCPD = CQOrganization.urls.urlXCPD;
    organization.urlDQ = CQOrganization.urls.urlDQ;
    organization.urlDR = CQOrganization.urls.urlDR;
  }

  public getDetails(): CQOrgDetails {
    return {
      name: this.name,
      oid: this.oid,
      addressLine1: this.addressLine1,
      city: this.city,
      state: this.state,
      postalCode: this.postalCode,
      lat: this.lat,
      lon: this.lon,
      contactName: this.contactName,
      phone: this.phone,
      email: this.email,
      role: this.role,
      hostOrgOID: this.hostOrgOID,
    };
  }

  public getUrls(): CQOrgUrls {
    return CQOrganization.urls;
  }

  public getDetailsAndUrls(): CQOrgUrls & CQOrgDetails {
    return {
      ...this.getDetails(),
      ...this.getUrls(),
    };
  }

  public buildXmlStringFromTemplate(): string {
    return buildXmlStringFromTemplate(this.getDetailsAndUrls());
  }

  public setXmlString(xmlString: string) {
    this.xmlString = xmlString;
  }

  public getXmlString(): string {
    if (!this.xmlString) {
      this.setXmlString(this.buildXmlStringFromTemplate());
    }
    if (this.xmlString) return this.xmlString;
    throw new Error("XML string not set");
  }
}
