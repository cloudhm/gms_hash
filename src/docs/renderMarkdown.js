import { marked } from 'marked';

const ASSET_BASE = '/shoplazza-docs/';

function rewriteAssetHref(href) {
  if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
    return href;
  }
  if (href.startsWith('./')) return ASSET_BASE + href.slice(2);
  if (href.startsWith('../')) {
    if (href.includes('README.md')) return '/';
    if (href.includes('.env.example')) return '/docs/environment-variables';
    return href;
  }
  return href;
}

function rewriteDocLink(href) {
  if (!href?.startsWith('./') || !href.endsWith('.md')) return null;
  const name = href.slice(2).replace(/\.md$/i, '');
  if (name === 'README') return '/docs';
  return `/docs/${name}`;
}

marked.use({
  renderer: {
    link(token) {
      const href = token.href;
      const doc = rewriteDocLink(href);
      const url = doc ?? rewriteAssetHref(href);
      const title = token.title ? ` title="${token.title}"` : '';
      return `<a href="${url}"${title}>${token.text}</a>`;
    },
    image(token) {
      const src = rewriteAssetHref(token.href);
      const title = token.title ? ` title="${token.title}"` : '';
      return `<img src="${src}" alt="${token.text || ''}"${title} loading="lazy" />`;
    },
  },
});

export function renderMarkdown(source) {
  return marked.parse(source, { async: false });
}