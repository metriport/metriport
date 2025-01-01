export function required<T>(dependent: keyof T) {
  return {
    when: (dependency: keyof T) => {
      return (val: T) => {
        if (val[dependency])
          return (
            val[dependent] !== undefined &&
            (typeof val[dependent] === "string" ? (val[dependent] as string).trim() !== "" : true)
          );
        return true;
      };
    },
  };
}
