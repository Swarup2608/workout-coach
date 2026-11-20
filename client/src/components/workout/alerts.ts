"use client";

/** Rest-over alerts: a short beep, a vibration, and a notification when the app is in the background. */

let ctx: AudioContext | null = null;

export function beep() {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    for (const [i, f] of [880, 1320].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.17);
    }
  } catch {
    // no audio available
  }
}

/** Browsers only allow audio after a user gesture: call this from a tap. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // ignore
  }
}

export function vibrate() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // ignore
  }
}

/** Asked once, when the first workout starts. */
export async function askNotificationPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission();
  } catch {
    // ignore
  }
}

export function notify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
    const n = new Notification(title, { body, tag: "rest-timer", icon: "/icon.png" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore
  }
}
