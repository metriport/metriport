import dayjs from "dayjs";

export const formatStartDate = (date: string): string => {
  return dayjs(date).toISOString();
};

export const formatEndDate = (date: string): string => {
  return dayjs(date).add(24, "hours").toISOString();
};

export const getStartAndEndDateTime = (date: string) => {
  return {
    start_date: dayjs(date).toISOString(),
    end_date: dayjs(date).add(24, "hours").toISOString(),
  };
};

export const getStartAndEndDate = (date: string) => {
  return {
    start_date: date,
    end_date: dayjs(date).add(24, "hours").format("YYYY-MM-DD"),
  };
};
