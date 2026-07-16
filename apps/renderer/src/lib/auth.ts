export function isUnauthorizedError(err: any) {
  const msg = String(err?.message || "");
  const code = String(err?.code || "");
  return msg.includes("UNAUTHORIZED") || code === "UNAUTHORIZED";
}

export function handleUnauthorized(err: any) {
  if (!isUnauthorizedError(err)) return false;

  window.alert("لازم تسجّل الدخول من صفحة Staff أولاً");
  // إذا تحب يوديك تلقائيًا:
  window.location.hash = "#/staff";
  return true;
}