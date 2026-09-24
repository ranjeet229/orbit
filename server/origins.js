// Allow the two common loopback names only on the configured development port.
// Production always uses the single, explicitly configured application origin.
export function allowedOrigins(appOrigin, production) {
  const url = new URL(appOrigin);
  const origins = new Set([url.origin]);
  if (
    !production &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const alias = new URL(url.origin);
      alias.hostname = host;
      origins.add(alias.origin);
    }
  }
  return [...origins];
}
