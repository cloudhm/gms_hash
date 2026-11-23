/** 侧边栏顺序（slug 对应 `public/shoplazza-docs/{slug}.md`，空串为 README） */
export const docNav = [
  { title: '接入索引', slug: '' },
  { title: '接入流程图', slug: 'onboarding-flow' },
  { title: '本项目说明', slug: 'overview' },
  { title: '环境变量', slug: 'environment-variables' },
  { title: 'GOOVAL app-config', slug: 'gooval-app-config' },
  { title: '创建私有应用', slug: 'private-app' },
  { title: '测试环境开通', slug: 'test-environment' },
  { title: 'GOOVAL 接入', slug: 'gooval-onboarding' },
  { title: '部署 Cloudflare', slug: 'deploy-cloudflare' },
  { title: 'Zero Trust 访问控制', slug: 'cloudflare-access' },
  { title: '店面行为', slug: 'storefront' },
  { title: '联调与排障', slug: 'troubleshooting' },
  { title: '主题兼容性', slug: 'theme-compatibility' },
  { title: '对接方说明', slug: 'partner' },
];

export function slugToFilename(slug) {
  const s = (slug || '').replace(/^\/+|\/+$/g, '');
  if (!s || s === 'README') return 'README.md';
  if (!/^[a-z0-9-]+$/i.test(s)) return null;
  return `${s}.md`;
}

export function docsPath(slug) {
  return slug ? `/docs/${slug}` : '/docs';
}