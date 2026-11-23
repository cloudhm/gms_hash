import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import App from './App.vue';
import StatusPage from './pages/StatusPage.vue';
import AdminPage from './pages/AdminPage.vue';
import DocsPage from './pages/DocsPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: StatusPage },
    { path: '/admin', component: AdminPage },
    { path: '/docs/:slug?', component: DocsPage },
  ],
});

createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app');
