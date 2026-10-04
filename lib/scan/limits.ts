// Shared by the browser (checks before upload) and the server (checks again)
export const MAX_SCAN_PAGES = 10
// All pages together. Base64 grows files by a third and OpenAI caps a request at 32 MB
export const MAX_SCAN_BYTES = 24 * 1024 * 1024
