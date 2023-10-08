import { MedplumClient, QueryTypes, ReadablePromise, ResourceArray } from "@medplum/core";
import { Bundle, BundleLink, ExtractResource, ResourceType } from "@medplum/fhirtypes";
import { FhirAdminClient, FhirClient } from "./api";

export const DEFAULT_TENANT = "DEFAULT";

/**
 * Don't use this class directly. Use the factory function `makeFhirApi()` instead.
 */
export class HapiFhirClient extends MedplumClient implements FhirClient {
  /**
   * Creates a new FHIR client configured to access a specific tenant's data.
   *
   * @param tenantId the customer ID, used to determine the tenant on HAPI (data isolation per cx)
   * @param baseUrl the base URL of the server, don't send `undefined` otherwise it'll point to Medplum's server
   */
  constructor(tenantId: string, baseUrl: string) {
    super({ baseUrl, fhirUrlPath: `fhir/${tenantId}` });
  }

  // needed to hack around HAPI FHIR urls returned in search queries
  // warning: this removes caching from the client... cannot access the cache here
  //          since the cache is private
  // TODO: make a PR to the client to support search() without appending the
  //       resource type to the URL. For example, this is the pagination URL from HAPI
  //       when querying orgs: fhir?_getpages=4786a0c4-c896-4cc8-bec6-37235745f17a&_getpagesoffset=20&_count=20&_pretty=true&_bundletype=searchset"
  //       note the missing /Organization in the path - this is the only workaround I've found.
  searchNoAppend<K extends ResourceType>(
    resourceType: K,
    query?: QueryTypes
  ): ReadablePromise<Bundle<ExtractResource<K>>> {
    const url = new URL(
      this.fhirSearchUrl(resourceType, query).href.replace(`/${resourceType}`, "")
    );

    const promise = new ReadablePromise(
      (async () => {
        const bundle = await this.get<Bundle<ExtractResource<K>>>(url);
        return bundle;
      })()
    );
    return promise;
  }

  // needed to hack around HAPI FHIR urls returned in search queries
  override async *searchResourcePages<K extends ResourceType>(
    resourceType: K,
    query?: QueryTypes
  ): AsyncGenerator<ResourceArray<ExtractResource<K>>> {
    let url: URL | undefined = this.fhirSearchUrl(resourceType, query);
    let isNext = false;

    while (url) {
      const searchParams: URLSearchParams = url.searchParams;
      const bundle = isNext
        ? await this.searchNoAppend(resourceType, searchParams)
        : await this.search(resourceType, searchParams, { cache: "no-cache" });
      const nextLink: BundleLink | undefined = bundle?.link?.find(link => link.relation === "next");
      if (!bundle?.entry?.length && !nextLink) {
        break;
      }

      const bundleResources = bundle?.entry?.map(e => e.resource as ExtractResource<K>) ?? [];

      yield Object.assign(bundleResources, { bundle });

      const nextUrl = nextLink?.url ? new URL(nextLink?.url) : undefined;
      if (nextUrl) {
        // modify url to point to internal FHIR URL
        let newUrl = nextUrl.href.replace(nextUrl.origin, this.getBaseUrl());
        newUrl = newUrl.replace("/oauth", "");
        url = new URL(newUrl);
        isNext = true;
      } else {
        url = undefined;
      }
    }
  }
}

/**
 * Don't use this class directly. Use the factory function `makeFhirAdminApi()` instead.
 */
export class HapiFhirAdminClient extends HapiFhirClient implements FhirAdminClient {
  /**
   * Creates a new FHIR client setup for administration/management purposes.
   */
  constructor(baseUrl: string) {
    super(DEFAULT_TENANT, baseUrl);
  }

  private readonly baseHAPIPayload = { resourceType: "Parameters" };

  async createTenant(org: { organizationNumber: number; cxId: string }): Promise<void> {
    const url = this.fhirUrl("$partition-management-create-partition");
    const payload = {
      ...this.baseHAPIPayload,
      parameter: [
        { name: "id", valueInteger: org.organizationNumber },
        { name: "name", valueCode: org.cxId },
      ],
    };
    await this.post(url, payload);
  }

  async listTenants(): Promise<string[]> {
    const url = this.fhirUrl("$partition-management-list-partitions");
    const payload = {
      ...this.baseHAPIPayload,
      parameter: [],
    };
    const res = await this.post(url, payload);
    return res.parameter
      ? res.parameter
          .flatMap((p: any) => p.part) //eslint-disable-line @typescript-eslint/no-explicit-any
          .filter((p: any) => p.name === "name") //eslint-disable-line @typescript-eslint/no-explicit-any
          .map((p: any) => p.valueCode) //eslint-disable-line @typescript-eslint/no-explicit-any
      : [];
  }

  async deleteTenant(org: { organizationNumber: number }): Promise<void> {
    const url = this.fhirUrl("$partition-management-delete-partition");
    const payload = {
      ...this.baseHAPIPayload,
      parameter: [{ name: "id", valueInteger: org.organizationNumber }],
    };
    await this.post(url, payload);
  }
}
