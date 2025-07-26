/**
 * Creates a file blob and triggers a browser download.
 * @param filename The name of the file to be downloaded.
 * @param content The string content of the file.
 * @param mimeType The MIME type of the file.
 */
export function triggerDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
