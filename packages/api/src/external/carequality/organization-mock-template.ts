import { CQOrgDetails } from "./organization";

export function buildMockOrganizationFromTemplate(org: CQOrgDetails) {
  return `{
          "identifier": {
              "use": {
                  "value": "official"
              },
              "system": {
                  "value": "http://www.hl7.org/oid/"
              },
              "value": {
                  "value": "urn:oid:${org.oid}"
              }
          },
          "meta": {
              "lastUpdated": {
                  "value": "2023-11-23T16:27:59Z"
              },
              "versionId": {
                  "value": "1"
              }
          },
          "name": {
              "value": "${org.name}"
          },
          "type": {
              "coding": {
                  "system": {
                      "value": "http://hl7.org/fhir/organization-type"
                  },
                  "code": {
                      "value": "Implementer"
                  }
              }
          },
          "active": {
              "value": true
          },
          "contact": [
              {
                  "purpose": {
                      "value": "Operations"
                  },
                  "name": {
                      "use": {
                          "value": "official"
                      },
                      "text": {
                          "value": "Imaginary Team"
                      }
                  },
                  "telecom": [
                      {
                          "system": {
                              "value": "email"
                          },
                          "value": {
                              "value": "fake_email@metriport.com"
                          },
                          "use": {
                              "value": "work"
                          }
                      },
                      {
                          "system": {
                              "value": "phone"
                          },
                          "value": {
                              "value": "123-123-1234"
                          },
                          "use": {
                              "value": "work"
                          }
                      }
                  ],
                  "address": {
                      "use": {
                          "value": "work"
                      },
                      "type": {
                          "value": "both"
                      },
                      "line": [
                          {
                              "value": "123 Sample St"
                          },
                          {
                              "value": ""
                          }
                      ],
                      "city": {
                          "value": "San Francisco"
                      },
                      "postalCode": {
                          "value": "12345"
                      },
                      "country": {
                          "value": "USA"
                      }
                  }
              }
          ],
          "address": [
              {
                  "use": {
                      "value": "work"
                  },
                  "type": {
                      "value": "both"
                  },
                  "line": {
                      "value": "123 Sample St"
                  },
                  "city": {
                      "value": "San Francisco"
                  },
                  "state": {
                      "value": "CA"
                  },
                  "postalCode": {
                      "value": "12345"
                  },
                  "country": {
                      "value": "USA"
                  },
                  "extension": {
                      "url": "OrgPosition",
                      "valueCodeableConcept": {
                          "coding": {
                              "system": {
                                  "value": "https://sequoiaproject.org/StructureDefinition/Address/Position/1.0.0"
                              },
                              "value": {
                                  "position": {
                                      "latitude": {
                                          "value": "${org.lat}"
                                      },
                                      "longitude": {
                                          "value": "${org.lon}"
                                      }
                                  }
                              }
                          }
                      }
                  }
              }
          ],
          "contained": [
              {
                  "Endpoint": {
                      "name": {
                          "value": "Patient Discovery"
                      },
                      "address": {
                          "value": "https://fake-org-xcpd-link/v1"
                      },
                      "connectionType": {
                          "system": {
                              "value": "http://hl7.org/fhir/subscription-channel-type"
                          },
                          "code": {
                              "value": "ihe-xcpd"
                          }
                      },
                      "extension": {
                          "url": "https://sequoiaproject.org/StructureDefinition/Endpoint/main/1.0.0",
                          "extension": [
                              {
                                  "url": "Transaction",
                                  "valueString": {
                                      "value": "XCPD ITI-55"
                                  }
                              },
                              {
                                  "url": "Actor",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Actor/1.0.0"
                                          },
                                          "value": {
                                              "value": "Responding Gateway"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "Version",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Version/1.0.0"
                                          },
                                          "value": {
                                              "value": "2.0"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "UseCases",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/UseCases/1.0.0"
                                          },
                                          "value": {
                                              "value": "QueryBasedDocumentExchange"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "PurposesOfUse",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/PurposesOfUse/1.0.0"
                                          },
                                          "value": {
                                              "value": "Treatment"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "Roles",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Roles/1.0.0"
                                          },
                                          "value": {
                                              "value": "All"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "IPA",
                                  "valueCodeableConcept": {
                                      "system": {
                                          "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/IPA/1.0.0"
                                      }
                                  }
                              }
                          ]
                      }
                  }
              },
              {
                  "Endpoint": {
                      "name": {
                          "value": "Query for Documents"
                      },
                      "address": {
                          "value": "https://fake-org-xca-link/dq/v1"
                      },
                      "connectionType": {
                          "system": {
                              "value": "http://hl7.org/fhir/subscription-channel-type"
                          },
                          "code": {
                              "value": "ihe-xca"
                          }
                      },
                      "extension": {
                          "url": "https://sequoiaproject.org/StructureDefinition/Endpoint/main/1.0.0",
                          "extension": [
                              {
                                  "url": "Transaction",
                                  "valueString": {
                                      "value": "XCA ITI-38"
                                  }
                              },
                              {
                                  "url": "Actor",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Actor/1.0.0"
                                          },
                                          "value": {
                                              "value": "Responding Gateway"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "Version",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Version/1.0.0"
                                          },
                                          "value": {
                                              "value": "2.0"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "UseCases",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/UseCases/1.0.0"
                                          },
                                          "value": {
                                              "value": "QueryBasedDocumentExchange"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "PurposesOfUse",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/PurposesOfUse/1.0.0"
                                          },
                                          "value": {
                                              "value": "Treatment"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "Roles",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Roles/1.0.0"
                                          },
                                          "value": {
                                              "value": "All"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "IPA",
                                  "valueCodeableConcept": {
                                      "system": {
                                          "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/IPA/1.0.0"
                                      }
                                  }
                              }
                          ]
                      }
                  }
              },
              {
                  "Endpoint": {
                      "name": {
                          "value": "Retrieve Documents"
                      },
                      "address": {
                          "value": "https://fake-org-xca-link/dr/v1"
                      },
                      "connectionType": {
                          "system": {
                              "value": "http://hl7.org/fhir/subscription-channel-type"
                          },
                          "code": {
                              "value": "ihe-xca"
                          }
                      },
                      "extension": {
                          "url": "https://sequoiaproject.org/StructureDefinition/Endpoint/main/1.0.0",
                          "extension": [
                              {
                                  "url": "Transaction",
                                  "valueString": {
                                      "value": "XCA ITI-39"
                                  }
                              },
                              {
                                  "url": "Actor",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Actor/1.0.0"
                                          },
                                          "value": {
                                              "value": "Responding Gateway"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "Version",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Version/1.0.0"
                                          },
                                          "value": {
                                              "value": "2.0"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "UseCases",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/UseCases/1.0.0"
                                          },
                                          "value": {
                                              "value": "QueryBasedDocumentExchange"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "PurposesOfUse",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/PurposesOfUse/1.0.0"
                                          },
                                          "value": {
                                              "value": "Treatment"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "Roles",
                                  "valueCodeableConcept": {
                                      "coding": {
                                          "system": {
                                              "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/Roles/1.0.0"
                                          },
                                          "value": {
                                              "value": "All"
                                          }
                                      }
                                  }
                              },
                              {
                                  "url": "IPA",
                                  "valueCodeableConcept": {
                                      "system": {
                                          "value": "https://sequoiaproject.org/StructureDefinition/Endpoint/IPA/1.0.0"
                                      }
                                  }
                              }
                          ]
                      }
                  }
              }
          ]
  }`;
}
