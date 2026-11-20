/** Incoming match invite ringtone - loops until accept / decline / cancel. */

let incomingRingtone: HTMLAudioElement | null = null;
let vibrateTimer: number | null = null;

export function stopInviteAlert(): void {
  if (incomingRingtone) {
    incomingRingtone.pause();
    incomingRingtone.currentTime = 0;
    incomingRingtone = null;
  }
  if (vibrateTimer != null) {
    window.clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(0);
  }
}

/** Looping challenge ringtone while an invite is pending accept/decline. */
export function startInviteAlert(): void {
  stopInviteAlert();
  if (typeof window === "undefined") return;
  try {
    // Soft warm loop (original Dama) - lovable, not an urgent alarm.
    const audio = new Audio("/sounds/invite-ring.wav");
    audio.loop = true;
    audio.volume = 0.48;
    void audio.play().catch(() => {});
    incomingRingtone = audio;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      const pulse = () => navigator.vibrate([180, 120, 180]);
      pulse();
      vibrateTimer = window.setInterval(pulse, 2400);
    }
  } catch {
    /* optional */
  }
}

export function playInviteResolvedChime(): void {
  stopInviteAlert();
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
    audio.volume = 0.75;
    void audio.play().catch(() => {});
  } catch {
    /* optional */
  }
}

/** Short chime when an outgoing invite is successfully sent. */
export function playInviteSentAlert(): void {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    audio.volume = 0.55;
    void audio.play().catch(() => {});
  } catch {
    /* optional */
  }
}
