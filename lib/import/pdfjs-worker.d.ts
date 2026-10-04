// pdf.js ships no types for its worker module; lib/import/pdfPages.ts only passes it back to pdf.js
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown
}
