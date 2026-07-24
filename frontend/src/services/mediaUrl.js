import api from "./api";

const MEDIA_BASE = import.meta.env.VITE_MEDIA_URL
  ? import.meta.env.VITE_MEDIA_URL.replace(/\/api$/, '')
  : (import.meta.env.DEV ? 'http://localhost:5005' : null);

export const getMediaBaseUrl = () => {
  return MEDIA_BASE || (api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api$/, '') : "");
};

export const getMediaFileUrl = (mediaId, variant = "medium") => {
  if (!mediaId) return "";
  return `${getMediaBaseUrl()}/media/file/${mediaId}?variant=${variant}`;
};

export const getHlsUrl = (mediaId) => {
  if (!mediaId) return "";
  return `${getMediaBaseUrl()}/media/hls/${mediaId}/index.m3u8`;
};
