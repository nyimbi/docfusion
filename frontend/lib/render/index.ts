/**
 * Render Module - DocFusion
 *
 * Exports all rendering utilities for document export.
 */

export { tiptapToLatex, tiptapToPlainText, generateProposalTemplate } from "./latex-converter";
export { tiptapToDocxIR, generateDocxBuffer, tiptapToDocx } from "./docx-converter";
export { tiptapToPptxIR, generatePptxBuffer, tiptapToPptx, estimateSlideCount } from "./pptx-converter";
export type { DocxDocument, DocxElement } from "./docx-converter";
export type { PptxDocument, PptxSlide, SlideTemplate } from "./pptx-converter";
