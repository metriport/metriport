export type BaseDTO = {
  eTag: string;
};

export function toBaseDTO(model: { version: number }): BaseDTO {
  return {
    eTag: String(model.version),
  };
}
