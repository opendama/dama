import { restClient } from "@/lib/api";
import { type ChatEmojiCatalog, isChatEmojiCatalogReady } from "@/lib/chat-emoji-catalog";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export function useChatEmojiCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: ["chrome", "chat-emoji-catalog"] as const,
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<ChatEmojiCatalog>("/public/chat-emoji-catalog");
      if (!isChatEmojiCatalogReady(data)) {
        throw new Error("chat emoji catalog unavailable");
      }
      return data;
    },
  });
}

export { isChatEmojiCatalogReady };
export type { ChatEmojiCatalog };
