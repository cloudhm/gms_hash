<template>
  <el-card>
    <template #header>
      <div class="hdr">
        <span>Shipping Secure Service</span>
        <el-button type="primary" link @click="$router.push('/admin')">管理</el-button>
      </div>
    </template>
    <p class="hint">这是私有 App 状态页（Vue + Cloudflare Pages），不是店匠后台。</p>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="health">{{ health }}</el-descriptions-item>
      <el-descriptions-item label="productId">{{ cfg.productId || '—' }}</el-descriptions-item>
      <el-descriptions-item label="handle">{{ cfg.handle || '—' }}</el-descriptions-item>
      <el-descriptions-item label="rate">{{ cfg.rate ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="maxCovered">{{ cfg.maxCovered ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="feeCap">{{ cfg.feeCap ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="variants">
        {{ (cfg.variants || []).length || error || '—' }}
      </el-descriptions-item>
    </el-descriptions>
    <el-alert v-if="error" class="gap" type="error" :title="error" show-icon :closable="false" />
    <p class="links">
      <a href="/health">/health</a>
      ·
      <a href="/widget.js">/widget.js</a>
      ·
      <a href="/widget/config">/widget/config</a>
      ·
      <router-link to="/admin">/admin</router-link>
    </p>
  </el-card>
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

<style scoped>
.hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hint,
.links {
  color: #606266;
  font-size: 13px;
}
.gap {
  margin-top: 12px;
}
</style>
