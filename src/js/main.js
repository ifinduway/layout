const BASE_URL = window.location.protocol + "//" + window.location.host;
const PATH_URL = window.location.pathname;
const FULL_URL = window.location.href;
const GET_PARAM = (key) => {
  return new URL(FULL_URL).searchParams.get(key);
};

@@include('partial/main.js')
