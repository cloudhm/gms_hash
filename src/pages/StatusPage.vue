<template>
  <div>
    <h1>Shipping Secure Service</h1>
    <p>这是私有 App 状态页（Vue + Cloudflare Pages），不是店匠后台。</p>
    <table>
      <tbody>
        <tr><th>health</th><td>{{ health }}</td></tr>
        <tr><th>productId</th><td>{{ cfg.productId || '—' }}</td></tr>
        <tr><th>handle</th><td>{{ cfg.handle || '—' }}</td></tr>
        <tr><th>rate</th><td>{{ cfg.rate ?? '—' }}</td></tr>
        <tr><th>maxCovered</th><td>{{ cfg.maxCovered ?? '—' }}</td></tr>
        <tr><th>feeCap</th><td>{{ cfg.feeCap ?? '—' }}</td></tr>
        <tr><th>variants</th><td>{{ (cfg.variants || []).length || error || '—' }}</td></tr>
      </tbody>
    </table>
    <p v-if="error" class="err">{{ error }}</p>
    <p>
      <a href="/health">/health</a> ·
      <a href="/widget.js">/widget.js</a> ·
      <a href="/widget/config">/widget/config</a> ·
      <router-link to="/admin">/admin</router-link>
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const health = ref('…');
const cfg = ref({});
const error = ref('');

onMounted(async () => {
  try {
    const h = await fetch('/health').then((r) => r.json());
    health.value = h.ok ? 'ok' : JSON.stringify(h);
  } catch (e) {
    health.value = String(e.message || e);
  }
  try {
    const res = await fetch('/widget/config');
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'HTTP ' + res.status);
    cfg.value = body;
  } catch (e) {
    error.value = String(e.message || e);
  }
});
</script>
