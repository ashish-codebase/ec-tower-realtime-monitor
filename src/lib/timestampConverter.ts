// Re-export from python/timestamp_converter.js
export function timestampToUTC(seconds: number, nanoseconds: number): string {
    const date = new Date(seconds * 1000);
    const iso = date.toISOString().replace(/\.\d{3}Z$/, "");
    return `${iso}.${String(nanoseconds).padStart(9, "0")}Z`;
}
