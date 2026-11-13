<template>
  <el-space direction="vertical" fill style="width: 100%" :size="16">
    <el-page-header @back="$router.push('/')">
      <template #content>
        <span>Script Tag · Webhook 管理</span>
      </template>
    </el-page-header>

    <el-alert
      title="访问限制由 Cloudflare 控制。TOKEN 只在 Functions 里使用。"
      type="info"
      :closable="false"
    />

    <el-card>
      <el-button type="primary" :loading="loading" @click="refresh">刷新全部</el-button>
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

    <el-card>
      <template #header>Webhook 注册</template>
      <p class="hint">
        默认地址为本站 <code>/webhooks</code>。topic 必须是平台允许列表中的值（例如
        <code>orders/update</code>）。
      </p>
      <el-form label-position="top">
        <el-form-item label="address">
          <el-input v-model="address" />
        </el-form-item>
        <el-form-item label="topic">
          <el-select
            v-model="topic"
            filterable
            allow-create
            default-first-option
            placeholder="orders/create"
            style="width: 100%"
          >
            <el-option v-for="t in topics" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-button type="primary" @click="createHook">注册 Webhook</el-button>
      </el-form>
    </el-card>

    <el-table :data="hooks" border empty-text="暂无 Webhook">
      <el-table-column prop="id" label="id" min-width="220">
        <template #default="{ row }">
          <code>{{ row.id }}</code>
        </template>
      </el-table-column>
      <el-table-column label="address / topic" min-width="280">
        <template #default="{ row }">
          <el-input v-model="row.address" class="mb" />
          <el-input v-model="row.topic" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="saveHook(row)">更新</el-button>
          <el-button type="danger" size="small" @click="delHook(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-space>
</template>

<script setup>
import { ElMessageBox } from 'element-plus';
import { onMounted, ref } from 'vue';

const topics = [
  'cart/create',
  'cart/update',
  'fulfillments/create',
  'fulfillments/update',
  'orders/cancelled',
  'orders/create',
  'orders/delete',
  'orders/finished',
  'orders/fulfilled',
  'orders/paid',
  'orders/partially_fulfilled',
  'orders/partially_refunded',
  'orders/refunded',
  'orders/update',
  'procurements/create',
  'procurements/update',
  'products/create',
  'products/delete',
  'products/update',
  'suppliers/create',
  'suppliers/delete',
  'suppliers/update',
  'app/subscriptions_update',
  'app/subscriptions_approaching_capped_amount',
  'app/purchases_one_time_update',
];

const loading = ref(false);
const msg = ref('');
const ok = ref(true);
const src = ref('');
const scope = ref('index,collection,product,search,cart');
const address = ref('');
const topic = ref('');
const tags = ref([]);
const hooks = ref([]);

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

async function refreshHooks() {
  const data = await api('/admin/api/webhooks');
  if (!address.value) address.value = data.defaultAddress || '';
  hooks.value = (data.webhooks || []).map((h) => ({ ...h }));
  return hooks.value.length;
}

async function refresh() {
  loading.value = true;
  try {
    const nTags = await refreshTags();
    try {
      const nHooks = await refreshHooks();
      setMsg('已加载 Script Tag ' + nTags + ' 条、Webhook ' + nHooks + ' 条', true);
    } catch (e) {
      hooks.value = [];
      setMsg('Script Tag ' + nTags + ' 条；Webhook：' + e.message, false);
    }
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

async function createHook() {
  try {
    await api('/admin/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ address: address.value, topic: topic.value }),
    });
    setMsg('Webhook 已注册', true);
    await refreshHooks();
  } catch (e) {
    setMsg(e.message, false);
  }
}

async function saveHook(h) {
  try {
    await api('/admin/api/webhooks/' + encodeURIComponent(h.id), {
      method: 'PUT',
      body: JSON.stringify({ address: h.address, topic: h.topic }),
    });
    setMsg('Webhook 已更新', true);
    await refreshHooks();
  } catch (e) {
    setMsg(e.message, false);
  }
}

async function delHook(h) {
  try {
    await ElMessageBox.confirm(
      '删除这条 Webhook？平台将不再向该地址推送 ' + (h.topic || '') + '。',
      '确认删除',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    await api('/admin/api/webhooks/' + encodeURIComponent(h.id), { method: 'DELETE' });
    setMsg('Webhook 已删除', true);
    await refreshHooks();
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
.hint {
  color: #606266;
  font-size: 13px;
}
</style>
