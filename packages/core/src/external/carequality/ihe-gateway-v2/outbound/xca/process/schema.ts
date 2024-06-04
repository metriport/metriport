import { z } from "zod";

const slot = z.object({
  ValueList: z.object({
    Value: z.union([z.string(), z.number()]), // this should probably support a list too
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
  Slot: z.union([slot, z.array(slot)]),
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
  Classification: z.union([classification, z.array(classification)]),
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
  RegistryError: z.union([registryError, z.array(registryError)]),
  _highestSeverity: z.string(),
});
export type RegistryErrorList = z.infer<typeof registryErrorList>;

export const iti38Body = z.object({
  AdhocQueryResponse: z.object({
    RegistryErrorList: registryErrorList.optional(),
    RegistryObjectList: z
      .union([
        z.object({
          ExtrinsicObject: z.union([extrinsicObject, z.array(extrinsicObject)]),
        }),
        z.literal(""),
      ])
      .optional(),
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
  DocumentUniqueId: z.union([z.string(), z.number()]),
  Document: z.union([z.string(), includeSchema]),
});

export type DocumentResponse = z.infer<typeof DocumentResponse>;

export const iti39Body = z.object({
  RetrieveDocumentSetResponse: z.object({
    RegistryResponse: z.object({
      _status: z.string(),
      RegistryErrorList: registryErrorList.optional(),
    }),
    DocumentResponse: z.union([DocumentResponse, z.array(DocumentResponse)]).optional(),
  }),
});

export const iti39Schema = z.object({
  Envelope: z.object({
    Header: z.any(),
    Body: iti39Body,
  }),
});

export const AddressSchema = z.object({
  line: z.union([z.string(), z.array(z.string())]).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  county: z.string().optional(),
});

export const NameSchema = z.object({
  given: z.union([z.string(), z.array(z.string())]),
  family: z.string(),
  delimiter: z.string().optional(),
});
export type IheName = z.infer<typeof NameSchema>;

export const TelecomSchema = z.object({
  _use: z.string().optional(),
  _value: z.string().optional(),
});
export type IheTelecom = z.infer<typeof TelecomSchema>;

export const IdentifierSchema = z.object({
  _root: z.string().optional(),
  _extension: z.string(),
});
export type IheIdentifier = z.infer<typeof IdentifierSchema>;

export const PatientRegistryProfileSchema = z.object({
  acknowledgement: z.object({
    typeCode: z.object({
      _code: z.string(),
    }),
  }),
  controlId: z.object({
    queryAck: z.object({
      queryResponseCode: z.object({
        _code: z.string(),
      }),
    }),
  }),
  controlActProcess: z.object({
    subject: z.object({
      registrationEvent: z.object({
        subject1: z.object({
          patient: z.object({
            id: z.object({
              _root: z.string().optional(),
              _extension: z.string(),
            }),
            patientPerson: z.object({
              addr: AddressSchema.optional(),
              name: NameSchema,
              telecom: TelecomSchema.optional(),
              asOtherIDs: z
                .object({
                  id: IdentifierSchema.optional(),
                })
                .optional(),
              administrativeGenderCode: z
                .object({
                  _code: z.string(),
                })
                .optional(),
              birthTime: z.object({
                _value: z.string(),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
});
export type PatientRegistryProfile = z.infer<typeof PatientRegistryProfileSchema>;

export const iti55Body = z.object({
  PRPA_IN201306UV02: PatientRegistryProfileSchema,
});

export const iti55Schema = z.object({
  Envelope: z.object({
    Header: z.any(),
    Body: iti55Body,
  }),
});
