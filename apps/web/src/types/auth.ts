/** Session user from REST OAuth exchange and related auth flows. */
export type AuthUser = {
  id: string;
  username: string;
  role: string;
  rating: number;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
  avatarThumbUrl?: string | null;
  avatarFullUrl?: string | null;
};

export type DeviceFingerprintInput = {
  fingerprint: string;
  platform: string;
  user_agent: string;
};

export type OtpStartResult = {
  challenge_id: string;
};

export type OtpVerifyInput = {
  challenge_id: string;
  code: string;
};
