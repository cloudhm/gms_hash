<template>
  <el-space direction="vertical" fill style="width: 100%" :size="16">
    <el-page-header @back="$router.push('/')">
      <template #content>
        <span>Script Tag 管理</span>
      </template>
    </el-page-header>

    <el-alert
      title="访问限制由 Cloudflare 控制。TOKEN 只在 Functions 里使用。保障商品与 Webhook 由对接方在店铺侧处理。"
      type="info"
      :closable="false"
    />

    <el-card>
      <el-button type="primary" :loading="loading" @click="refresh">刷新</el-button>
      <el-alert
        v-if="msg"
        class="gap"
        :title="msg"
        :type="ok ? 'success' : 'error'"
        show-icon
        :closable="false"
      />
    </el-card>

    <el-card>
      <template #header>Script Tag 注册</template>
      <el-form label-position="top">
        <el-form-item label="src">
          <el-input v-model="src" />
        </el-form-item>
        <el-form-item label="display_scope">
          <el-input v-model="scope" />
        </el-form-item>
        <el-button type="primary" @click="createTag">注册 Script Tag</el-button>
      </el-form>
    </el-card>

    <el-table :data="tags" border empty-text="暂无 Script Tag">
      <el-table-column prop="id" label="id" min-width="220">
        <template #default="{ row }">
          <code>{{ row.id }}</code>
        </template>
      </el-table-column>
      <el-table-column label="src / scope" min-width="280">
        <template #default="{ row }">
          <el-input v-model="row.src" class="mb" />
          <el-input v-model="row.display_scope" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="saveTag(row)">更新</el-button>
          <el-button type="danger" size="small" @click="delTag(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-space>
</template>

<script setup>
import { ElMessageBox } from 'element-plus';
import { onMounted, ref } from 'vue';

const loading = ref(false);
const msg = ref('');
const ok = ref(true);
const src = ref('');
const scope = ref('index,collection,product,search,cart');
const tags = ref([]);

function setMsg(text, isOk) {
  msg.value = text || '';
  ok.value = !!isOk;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'HTTP ' + res.status);
  return body;
}

async function refreshTags() {
  const data = await api('/admin/api/script-tags');
  if (!src.value) src.value = data.defaultSrc || '';
  tags.value = (data.tags || []).map((t) => ({ ...t }));
  return tags.value.length;
}

async function refresh() {
  loading.value = true;
  try {
    const nTags = await refreshTags();
    setMsg('已加载 Script Tag ' + nTags + ' 条', true);
  } catch (e) {
    setMsg(e.message, false);
  } finally {
    loading.value = false;
  }
}

async function createTag() {
  try {
    await api('/admin/api/script-tags', {
      method: 'POST',
      body: JSON.stringify({ src: src.value, display_scope: scope.value }),
    });
    setMsg('Script Tag 已注册', true);
    await refreshTags();
  } catch (e) {
    setMsg(e.message, false);
  }
}

async function saveTag(t) {
  try {
    await api('/admin/api/script-tags/' + encodeURIComponent(t.id), {
      method: 'PUT',
      body: JSON.stringify({ src: t.src, display_scope: t.display_scope }),
    });
    setMsg('Script Tag 已更新', true);
    await refreshTags();
  } catch (e) {
    setMsg(e.message, false);
  }
}

async function delTag(t) {
  try {
    await ElMessageBox.confirm('删除这条 Script Tag？店铺将不再注入该脚本。', '确认删除', {
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await api('/admin/api/script-tags/' + encodeURIComponent(t.id), { method: 'DELETE' });
    setMsg('Script Tag 已删除', true);
    await refreshTags();
  } catch (e) {
    setMsg(e.message, false);
  }
}

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.gap {
  margin-top: 12px;
}
.mb {
  margin-bottom: 8px;
}
</style>
