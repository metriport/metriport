export type BaseDTO = {
  id: string;
  eTag: string;
};

export function toBaseDTO(model: { id: string; eTag: string }): BaseDTO {
  return {
    id: model.id,
    eTag: model.eTag,
  };
}
