// Re-export from python/timestamp_converter.js
// Convert timestamp (seconds or milliseconds) to ISO string
//export function timestampToUTC(ts: number, nanoseconds: number = 0): string {
  // If timestamp is already in milliseconds (>= 1e12), don't multiply
//  const ms = ts >= 1e12 ? ts : ts * 1000;
//  const date = new Date(ms);
//  const iso = date.toISOString().replace(/\.\d{3}Z$/, "");
//  return `${iso}.${String(nanoseconds).padStart(9, "0")}Z`;
//}
export function timestampToUTC(ts: number, nanoseconds: number = 0): string {
  const ms = ts + nanoseconds/1e9;
  const date = new Date(ms*1000).toISOString();
  return date;
}