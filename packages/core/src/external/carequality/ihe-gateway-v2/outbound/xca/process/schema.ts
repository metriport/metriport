import { z } from "zod";
import {
  schemaOrEmpty,
  schemaOrArray,
  schemaOrArrayOrEmpty,
  slot,
  stringOrNumberSchema,
  schemaOrString,
} from "../../../schema";

const name = z.object({
  LocalizedString: schemaOrEmpty(
    z.object({
      _charset: z.string().optional(),
      _value: z.string(),
    })
  ),
});
export type Name = z.infer<typeof name>;

const classification = z.object({
  Slot: schemaOrArray(slot).optional(),
  Name: name.optional(),
  _classificationScheme: z.string(),
  _classifiedObject: z.string().optional(),
  _id: z.string().optional(),
  _nodeRepresentation: z.string().optional(),
  _objectType: z.string().optional(),
});
export type Classification = z.infer<typeof classification>;

const externalIdentifier = z.object({
  Name: name.optional(),
  _id: z.string().optional(),
  _identificationScheme: z.string(),
  _objectType: z.string().optional(),
  _registryObject: z.string().optional(),
  _value: z.string().optional(),
});
export type ExternalIdentifier = z.infer<typeof externalIdentifier>;

export const extrinsicObject = z.object({
  Slot: schemaOrArray(slot),
  Name: name.optional(),
  Classification: schemaOrArray(classification),
  ExternalIdentifier: z.array(externalIdentifier),
  _home: z.string(),
  _mimeType: z.string(),
});
export type ExtrinsicObject = z.infer<typeof extrinsicObject>;

export const registryError = z.object({
  _codeContext: z.string().optional(),
  _errorCode: z.string().optional(),
  _severity: z.string().optional(),
});
export type RegistryError = z.infer<typeof registryError>;

const registryErrorList = schemaOrString(
  z.object({
    RegistryError: schemaOrArray(registryError),
    _highestSeverity: z.string().optional(),
  })
);
export type RegistryErrorList = z.infer<typeof registryErrorList>;

export const iti38Body = z.object({
  AdhocQueryResponse: z.object({
    RegistryErrorList: registryErrorList.optional(),
    RegistryObjectList: schemaOrEmpty(
      z.object({
        ExtrinsicObject: schemaOrArrayOrEmpty(extrinsicObject),
      })
    ).optional(),
    _status: z.string(),
    _totalResultCount: z.string().optional(),
  }),
});

export const iti38Schema = z.object({
  Envelope: z.object({
    Body: iti38Body,
  }),
});

export type Iti38Response = z.infer<typeof iti38Schema>;

const includeSchema = z.object({
  Include: z.object({
    _href: z.string(),
  }),
});

export const documentResponse = z.object({
  size: z.string().optional(),
  title: z.string().optional(),
  creation: z.string().optional(),
  language: z.string().optional(),
  mimeType: z.string().optional(),
  HomeCommunityId: z.string().optional(),
  RepositoryUniqueId: z.string().optional(),
  NewDocumentUniqueId: z.string().optional(),
  NewRepositoryUniqueId: z.string().optional(),
  DocumentUniqueId: stringOrNumberSchema,
  Document: z.union([z.string(), includeSchema]),
});

export type DocumentResponse = z.infer<typeof documentResponse>;

export const iti39Body = z.object({
  RetrieveDocumentSetResponse: z.object({
    RegistryResponse: z.object({
      _status: z.string(),
      RegistryErrorList: registryErrorList.optional(),
    }),
    DocumentResponse: schemaOrArrayOrEmpty(documentResponse).optional(),
  }),
});

export const iti39Schema = z.object({
  Envelope: z.object({
    Body: iti39Body,
  }),
});
