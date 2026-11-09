// The PDF library, loaded when first needed, with its worker set up (for reading a PDF in the browser or showing one)
export async function pdfEngine() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  return pdfjs
}
