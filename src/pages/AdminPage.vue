<template>
  <div>
    <p><router-link to="/">← 状态</router-link></p>
    <h1>Script Tag · Webhook 管理</h1>
    <p>用 <code>APP_SECRET</code>（或 <code>ADMIN_KEY</code>）登录。TOKEN 只在 Cloudflare Functions 里使用。</p>
    <div class="card">
      <label>管理口令</label>
      <input v-model="key" type="password" autocomplete="off" />
      <div class="row">
        <button type="button" @click="refresh">进入 / 刷新全部</button>
      </div>
      <p :class="ok ? 'ok' : 'err'">{{ msg }}</p>
    </div>
    <div class="card">
      <h2>Script Tag 注册</h2>
      <label>src</label>
      <input v-model="src" type="text" />
      <label>display_scope</label>
      <input v-model="scope" type="text" />
      <div class="row">
        <button type="button" @click="createTag">注册 Script Tag</button>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>id</th><th>src / scope</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-if="!tags.length">
          <td colspan="3">{{ tagsNote }}</td>
        </tr>
        <tr v-for="t in tags" :key="t.id">
          <td><code>{{ t.id }}</code></td>
          <td>
            <input v-model="t.src" style="margin-bottom:6px" />
            <br />
            <input v-model="t.display_scope" />
          </td>
          <td>
            <button type="button" @click="saveTag(t)">更新</button>
            <button type="button" class="danger" @click="delTag(t)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="card">
      <h2>Webhook 注册</h2>
      <p>默认地址为本站 <code>/webhooks</code>。topic 必须是平台允许列表中的值（例如 <code>orders/update</code>）。</p>
      <label>address</label>
      <input v-model="address" type="text" />
      <label>topic</label>
      <input v-model="topic" type="text" list="hook-topics" placeholder="orders/create" />
      <datalist id="hook-topics">
        <option v-for="t in topics" :key="t" :value="t" />
      </datalist>
      <div class="row">
        <button type="button" @click="createHook">注册 Webhook</button>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>id</th><th>address / topic</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-if="!hooks.length">
          <td colspan="3">{{ hooksNote }}</td>
        </tr>
        <tr v-for="h in hooks" :key="h.id">
          <td><code>{{ h.id }}</code></td>
          <td>
            <input v-model="h.address" style="margin-bottom:6px" />
            <br />
            <input v-model="h.topic" />
          </td>
          <td>
            <button type="button" @click="saveHook(h)">更新</button>
            <button type="button" class="danger" @click="delHook(h)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
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

const key = ref(sessionStorage.getItem('sssAdminKey') || '');
const msg = ref('');
const ok = ref(true);
const src = ref('');
const scope = ref('index,collection,product,search,cart');
const address = ref('');
const topic = ref('');
const tags = ref([]);
const hooks = ref([]);
const tagsNote = ref('登录后加载');
const hooksNote = ref('登录后加载');

function setMsg(text, isOk) {
  msg.value = text || '';
  ok.value = !!isOk;
}

async function api(path, opts = {}) {
  sessionStorage.setItem('sssAdminKey', key.value || '');
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': key.value || '',
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
  tagsNote.value = tags.value.length ? '' : '暂无 Script Tag';
  return tags.value.length;
}

async function refreshHooks() {
  const data = await api('/admin/api/webhooks');
  if (!address.value) address.value = data.defaultAddress || '';
  hooks.value = (data.webhooks || []).map((h) => ({ ...h }));
  hooksNote.value = hooks.value.length ? '' : '暂无 Webhook';
  return hooks.value.length;
}

async function refresh() {
  try {
    const nTags = await refreshTags();
    try {
      const nHooks = await refreshHooks();
      setMsg('已加载 Script Tag ' + nTags + ' 条、Webhook ' + nHooks + ' 条', true);
    } catch (e) {
      hooks.value = [];
      hooksNote.value = e.message;
      setMsg('Script Tag ' + nTags + ' 条；Webhook：' + e.message, false);
    }
  } catch (e) {
    setMsg(e.message, false);
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
  if (!confirm('删除这条 Script Tag？店铺将不再注入该脚本。')) return;
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
  if (!confirm('删除这条 Webhook？平台将不再向该地址推送 ' + (h.topic || '') + '。')) return;
  try {
    await api('/admin/api/webhooks/' + encodeURIComponent(h.id), { method: 'DELETE' });
    setMsg('Webhook 已删除', true);
    await refreshHooks();
  } catch (e) {
    setMsg(e.message, false);
  }
}

onMounted(() => {
  if (key.value) refresh();
});
</script>
