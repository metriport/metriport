import Constants from "../constants";

export const storeRedirectUrl = (url: string | null) => {
  if (url && localStorage) {
    localStorage.setItem(Constants.SUCCESS_REDIRECT_URL_PARAM, decodeURI(url));
  }
};

export const storeFailRedirectUrl = (url: string | null) => {
  if (url && localStorage) {
    localStorage.setItem(Constants.FAILURE_REDIRECT_URL_PARAM, decodeURI(url));
  }
};
