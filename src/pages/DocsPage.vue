<template>
  <div class="docs-layout">
    <aside class="docs-aside">
      <div class="docs-aside-head">
        <router-link to="/" class="docs-home">← 状态页</router-link>
        <h2 class="docs-aside-title">店匠接入</h2>
      </div>
      <el-menu :default-active="activeSlug" router class="docs-menu">
        <el-menu-item v-for="item in docNav" :key="item.slug || 'index'" :index="docsPath(item.slug)">
          {{ item.title }}
        </el-menu-item>
      </el-menu>
    </aside>
    <main class="docs-main">
      <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" />
      <article v-else class="doc-body" v-html="html" />
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import 'd3-transition';
import mermaid from 'mermaid';
import { docNav, slugToFilename, docsPath } from '../docs/nav.js';
import { renderMarkdown } from '../docs/renderMarkdown.js';

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

const route = useRoute();
const html = ref('');
const error = ref('');

const activeSlug = computed(() => {
  const p = route.params.slug;
  if (!p || (Array.isArray(p) && !p.length)) return '/docs';
  const s = Array.isArray(p) ? p.join('/') : String(p);
  return `/docs/${s}`;
});

async function loadDoc() {
  error.value = '';
  html.value = '';
  const raw = route.params.slug;
  const slug = Array.isArray(raw) ? raw.join('/') : raw ? String(raw) : '';
  const file = slugToFilename(slug);
  if (!file) {
    error.value = '无效的文档路径';
    return;
  }
  try {
    const res = await fetch(`${ASSET_BASE}${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html.value = renderMarkdown(await res.text());
    document.title = `店匠接入 — ${file.replace(/\.md$/i, '')}`;
    await nextTick();
    const nodes = document.querySelectorAll('.doc-body pre.mermaid');
    if (nodes.length) {
      await mermaid.run({ nodes });
    }
  } catch (e) {
    error.value = String(e.message || e);
  }
}

const ASSET_BASE = '/shoplazza-docs/';

watch(() => route.fullPath, loadDoc, { immediate: true });
</script>

<style scoped>
.docs-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  max-width: 1200px;
  margin: 0 auto;
}

.docs-aside {
  flex: 0 0 220px;
  position: sticky;
  top: 16px;
  background: #fff;
  border-radius: 8px;
  padding: 12px 0;
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}

.docs-aside-head {
  padding: 0 16px 8px;
}

.docs-home {
  font-size: 13px;
  color: #409eff;
  text-decoration: none;
}

.docs-aside-title {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 600;
}

.docs-menu {
  border-right: none;
}

.docs-main {
  flex: 1;
  min-width: 0;
  background: #fff;
  border-radius: 8px;
  padding: 24px 32px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}

.doc-body :deep(h1) {
  font-size: 1.75rem;
  margin-top: 0;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 0.5rem;
}

.doc-body :deep(h2) {
  margin-top: 1.75rem;
  font-size: 1.25rem;
}

.doc-body :deep(h3) {
  margin-top: 1.25rem;
}

.doc-body :deep(img) {
  max-width: 100%;
  height: auto;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin: 12px 0;
}

.doc-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 14px;
  margin: 1rem 0;
}

.doc-body :deep(th),
.doc-body :deep(td) {
  border: 1px solid #ebeef5;
  padding: 8px 10px;
}

.doc-body :deep(th) {
  background: #f5f7fa;
}

.doc-body :deep(pre:not(.mermaid)) {
  overflow-x: auto;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
}

.doc-body :deep(pre.mermaid) {
  background: transparent;
  padding: 0;
  margin: 1rem 0;
  overflow: visible;
}

.doc-body :deep(svg) {
  max-width: 100%;
  height: auto;
}

.doc-body :deep(code) {
  font-size: 0.9em;
}

.doc-body :deep(a) {
  color: #409eff;
}

@media (max-width: 768px) {
  .docs-layout {
    flex-direction: column;
  }
  .docs-aside {
    position: static;
    width: 100%;
  }
}
</style>