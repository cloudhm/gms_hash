import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import App from './App.vue';
import StatusPage from './pages/StatusPage.vue';
import AdminPage from './pages/AdminPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: StatusPage },
    { path: '/admin', component: AdminPage },
  ],
});

router.beforeEach((to, from, next) => {
  if (to.path === '/admin' && from.matched.length > 0 && from.path !== '/admin') {
    console.log(to.fullPath);
    window.open(to.fullPath, '_blank');
    next(false);
    return;
  }
  next();
});

createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app');
