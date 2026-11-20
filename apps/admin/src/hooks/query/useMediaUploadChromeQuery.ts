import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type MediaUploadChrome, isMediaUploadChromeReady } from "@/types/media-upload-chrome";
import { useQuery } from "@tanstack/react-query";

export function mediaUploadChromeQueryKey() {
  return ["media-upload-chrome"] as const;
}

export function useMediaUploadChromeQuery(enabled = true) {
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: mediaUploadChromeQueryKey(),
    enabled,
    queryFn: async () => {
      const { data } = await restClient.get<MediaUploadChrome>("/public/media-upload-chrome");
      if (!isMediaUploadChromeReady(data)) {
        throw new Error((data?.media_upload_unavailable || "").trim());
      }
      return data;
    },
  });
}
