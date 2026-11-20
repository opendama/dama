import type { AuthUser } from "@/types/auth";
import type { AvatarUploadResult } from "@/types/player";

/** Map REST avatar upload user fields onto the session AuthUser shape. */
export function mergeAvatarIntoAuthUser(
  authUser: AuthUser,
  uploaded: AvatarUploadResult["user"],
): AuthUser {
  if (!uploaded) return authUser;
  return {
    ...authUser,
    avatarThumbUrl: uploaded.avatar_thumb_url ?? authUser.avatarThumbUrl,
    avatarFullUrl: uploaded.avatar_full_url ?? authUser.avatarFullUrl,
  };
}
