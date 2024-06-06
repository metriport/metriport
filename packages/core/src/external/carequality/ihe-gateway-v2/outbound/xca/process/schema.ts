import { z } from "zod";
import {
  schemaOrEmpty,
  schemaOrArray,
  schemaOrArrayOrEmpty,
  StringOrNumberSchema,
} from "../../../schema";

const slot = z.object({
  // even though this is called list, the IHE spec specifies its never a list: https://www.ihe-j.org/file2/docs/RFD/IHE_ITI_TF_R14_Vol3.pdf, Page 48
  ValueList: z.object({
    Value: StringOrNumberSchema,
  }),
  _name: z.string(),
});
export type Slot = z.infer<typeof slot>;

const name = z.object({
  LocalizedString: z.object({
    _charset: z.string(),
    _value: z.string(),
  }),
});
export type Name = z.infer<typeof name>;

const classification = z.object({
  Slot: schemaOrArray(slot),
  Name: name.optional(),
  _classificationScheme: z.string(),
  _classifiedObject: z.string(),
  _id: z.string(),
  _nodeRepresentation: z.string(),
  _objectType: z.literal(
    "urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification"
  ),
});
export type Classification = z.infer<typeof classification>;

const externalIdentifier = z.object({
  Name: name.optional(),
  _id: z.string(),
  _identificationScheme: z.string(),
  _objectType: z.literal(
    "urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier"
  ),
  _registryObject: z.string(),
  _value: z.string(),
});
export type ExternalIdentifier = z.infer<typeof externalIdentifier>;

export const extrinsicObject = z.object({
  Slot: z.union([slot, z.array(slot)]),
  Name: name.optional(),
  Classification: schemaOrArray(classification),
  ExternalIdentifier: z.array(externalIdentifier),
  _home: z.string(),
  _id: z.string(),
  _isOpaque: z.string(),
  _mimeType: z.string(),
  _objectType: z.string(),
  _status: z.string(),
});
export type ExtrinsicObject = z.infer<typeof extrinsicObject>;

export const registryError = z.object({
  _codeContext: z.string().optional(),
  _errorCode: z.string().optional(),
  _severity: z.string().optional(),
});
export type RegistryError = z.infer<typeof registryError>;

const registryErrorList = z.object({
  RegistryError: schemaOrArray(registryError),
  _highestSeverity: z.string().optional(),
});
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
    Header: z.any(),
    Body: iti38Body,
  }),
});

export type Iti38Response = z.infer<typeof iti38Schema>;

const includeSchema = z.object({
  Include: z.object({
    _href: z.string(),
  }),
});

export const DocumentResponse = z.object({
  size: z.string().optional(),
  title: z.string().optional(),
  creation: z.string().optional(),
  language: z.string().optional(),
  mimeType: z.string(),
  HomeCommunityId: z.string(),
  RepositoryUniqueId: z.string(),
  NewDocumentUniqueId: z.string().optional(),
  NewRepositoryUniqueId: z.string().optional(),
  DocumentUniqueId: StringOrNumberSchema,
  Document: z.union([z.string(), includeSchema]),
});

export type DocumentResponse = z.infer<typeof DocumentResponse>;

export const iti39Body = z.object({
  RetrieveDocumentSetResponse: z.object({
    RegistryResponse: z.object({
      _status: z.string(),
      RegistryErrorList: registryErrorList.optional(),
    }),
    DocumentResponse: schemaOrArrayOrEmpty(DocumentResponse).optional(),
  }),
});

export const iti39Schema = z.object({
  Envelope: z.object({
    Header: z.any(),
    Body: iti39Body,
  }),
});
