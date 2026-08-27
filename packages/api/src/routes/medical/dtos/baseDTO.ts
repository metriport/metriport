/**
 * @deprecated use @metriport/shared/domain/baseDto instead
 */
export type BaseDTO = {
  id: string;
  eTag: string;
};

/**
 * @deprecated use @metriport/shared/domain/baseDto instead
 */
export function toBaseDTO(model: { id: string; eTag: string }): BaseDTO {
  return {
    id: model.id,
    eTag: model.eTag,
  };
}
