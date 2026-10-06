import "server-only";

// puppeteer is stripped in this container environment.
// Server-side PDF export delegates to Word/Excel export or browser print.

export async function renderPdf({
  url: _url,
  cookie: _cookie,
}: {
  url: string;
  /** The caller's session cookie — the print page is behind auth. */
  cookie: string;
}): Promise<Buffer> {
  throw new Error(
    "Could not find Chrome: PDF export needs a Chrome binary, which this host does not provide. " +
    "Please use the print preview in your browser to Save as PDF, or download the Word (.docx) export.",
  );
}
