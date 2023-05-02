import { Bundle, BundleLink, ExtractResource, ResourceType } from "@medplum/fhirtypes";
import { Config } from "../../shared/config";
import { MedplumClient, QueryTypes, ReadablePromise } from "@medplum/core";

export class FHIRClient extends MedplumClient {
  static fhirServerUrl = Config.getFHIRServerUrl();
  constructor() {
    super({ baseUrl: FHIRClient.fhirServerUrl, fhirUrlPath: "fhir" });
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
  ): AsyncGenerator<ExtractResource<K>[]> {
    if (!FHIRClient.fhirServerUrl) return;
    let url: URL | undefined = this.fhirSearchUrl(resourceType, query);
    let isNext = false;

    while (url) {
      const searchParams: URLSearchParams = url.searchParams;
      const bundle = isNext
        ? await this.searchNoAppend(resourceType, searchParams)
        : await this.search(resourceType, searchParams);
      const nextLink: BundleLink | undefined = bundle?.link?.find(link => link.relation === "next");
      if (!bundle?.entry?.length && !nextLink) {
        break;
      }

      yield bundle?.entry?.map(e => e.resource as ExtractResource<K>) ?? [];
      const nextUrl = nextLink?.url ? new URL(nextLink?.url) : undefined;
      if (nextUrl) {
        // modify url to point to internal FHIR URL
        let newUrl = nextUrl.href.replace(nextUrl.origin, FHIRClient.fhirServerUrl);
        newUrl = newUrl.replace("/oauth", "");
        url = new URL(newUrl);
        isNext = true;
      } else {
        url = undefined;
      }
    }
  }
}

export const api = new FHIRClient();
