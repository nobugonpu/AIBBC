/**
 * Prints a full HTML document string reliably inside the Tauri WebView.
 *
 * `window.open('', '_blank')` is blocked in WebView2 (returns null), so the
 * old "open a new window and print" approach silently failed. Instead we
 * render the document into a hidden <iframe> in the current page and drive
 * the print dialog from the iframe's own window.
 */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // The iframe needs a REAL size so its document lays out fully — a 0x0 iframe
  // collapses the flow content and only the first item/page prints. Give it an
  // A4-ish viewport and hide it off-screen instead of sizing it to zero.
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '794px';   // ~A4 width at 96dpi
  iframe.style.height = '1123px'; // ~A4 height at 96dpi
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = () => {
    // Delay removal so the print dialog can finish capturing the content.
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 500);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let started = false;
  const run = () => {
    if (started) return;
    started = true;
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.focus();
    // Remove the iframe once the print dialog is dismissed.
    win.onafterprint = cleanup;
    win.print();
    // Fallback cleanup in case onafterprint never fires.
    setTimeout(cleanup, 60000);
  };

  // Give the browser a tick to lay out the written document.
  if (doc.readyState === 'complete') {
    setTimeout(run, 100);
  } else {
    iframe.onload = () => setTimeout(run, 100);
    // Safety net if onload doesn't fire for a written document.
    setTimeout(run, 400);
  }
}
