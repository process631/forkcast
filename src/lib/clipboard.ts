/**
 * Copy text. The Clipboard API only works on https or localhost, so when the app is opened
 * from a phone over the local network we fall back to selecting a hidden textarea.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length); // iOS Safari ignores select() alone
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
