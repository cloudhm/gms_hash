import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
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

createApp(App).use(router).mount('#app');
