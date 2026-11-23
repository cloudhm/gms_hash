<template>
  <el-config-provider :locale="zhCn">
    <div class="layout">
      <router-view />
    </div>
  </el-config-provider>
</template>

<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn';
</script>

<style>
body {
  margin: 0;
  background: #f5f7fa;
}
.layout {
  max-width: 960px;
  margin: 24px auto;
  padding: 0 16px 40px;
}
.layout:has(.docs-layout) {
  max-width: none;
  margin: 24px 16px;
}
</style>
