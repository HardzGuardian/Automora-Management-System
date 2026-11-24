// The MCP server never renders PDFs. This stub keeps @react-pdf/renderer (which does not load under plain Node/tsx) out of the process.
const unavailable = () => {
  throw new Error("PDF rendering is not available in the MCP server");
};
export const Document = unavailable;
export const Page = unavailable;
export const Text = unavailable;
export const View = unavailable;
export const StyleSheet = { create: <T>(styles: T): T => styles };
export const renderToBuffer = unavailable;
export const renderToStream = unavailable;
