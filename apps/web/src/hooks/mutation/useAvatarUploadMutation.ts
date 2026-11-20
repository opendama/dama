import { avatarChromeQueryKey } from "@/hooks/query/useAvatarChromeQuery";
import { meQueryKey } from "@/hooks/query/useMeQuery";
import { mergeAvatarIntoAuthUser } from "@/lib/auth-avatar";
import { patchAvatarEverywhere } from "@/lib/avatar-cache-patch";
import { cropSquare } from "@/lib/avatar-crop";
import { apiRestUrl } from "@/lib/env";
import { invalidateAvatarSurfaces, invalidateMe } from "@/lib/invalidate";
import { useAuthStore } from "@/store/auth";
import type { AvatarChrome } from "@/types/avatar-chrome";
import type { AvatarUploadResult, MeProfile } from "@/types/player";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type { AvatarUploadResult } from "@/types/player";

export function useAvatarUploadMutation(token: string | null | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<AvatarUploadResult> => {
      if (!token) throw new Error("");
      const chrome = qc.getQueryData<AvatarChrome>(avatarChromeQueryKey());
      const cropped = await cropSquare(file, 1024, {
        canvasUnavailable: (chrome?.crop_canvas_unavailable || "").trim(),
        cropFailed: (chrome?.crop_failed || "").trim(),
      });
      const body = new FormData();
      body.append("file", cropped, "avatar.webp");
      const res = await fetch(`${apiRestUrl()}/avatars/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as AvatarUploadResult & { error?: string };
      if (!res.ok) {
        throw new Error("");
      }
      return json;
    },
    onSuccess: (json) => {
      const thumb = json.user?.avatar_thumb_url ?? json.avatar?.thumb_url ?? null;
      const full = json.user?.avatar_full_url ?? json.avatar?.full_url ?? null;
      const auth = useAuthStore.getState();
      const authUser = auth.user;
      const userId = (json.user?.id || authUser?.id || "").trim();

      if (token && authUser && (thumb || full)) {
        auth.setSession(
          token,
          mergeAvatarIntoAuthUser(
            authUser,
            json.user ?? { avatar_thumb_url: thumb, avatar_full_url: full },
          ),
        );
      }

      if (token && (thumb || full)) {
        qc.setQueryData<MeProfile | null>(meQueryKey(token), (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            avatarThumbUrl: thumb ?? prev.avatarThumbUrl,
            avatarFullUrl: full ?? prev.avatarFullUrl,
          };
        });
      }

      if (userId && (thumb || full)) {
        patchAvatarEverywhere(qc, userId, thumb, full);
      }

      void invalidateMe(qc, token);
      void invalidateAvatarSurfaces(qc, userId || null);
    },
  });
}
