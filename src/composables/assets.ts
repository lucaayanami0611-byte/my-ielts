/** Resolve public assets for GitHub Pages, installed PWAs and native webviews. */
export function resolveAssetUrl(path: string) {
  return new URL(path.replace(/^\/+/, ''), document.baseURI).href
}
