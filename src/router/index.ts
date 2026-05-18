import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'workbench',
      component: () => import('@/views/Workbench.vue'),
      meta: { title: '视频字幕翻译' },
    },
    {
      path: '/auto-timing',
      name: 'auto-timing',
      component: () => import('@/views/AutoTiming.vue'),
      meta: { title: '自动打轴' },
    },
    {
      path: '/timed-asr',
      name: 'timed-asr',
      component: () => import('@/views/TimedAsr.vue'),
      meta: { title: '轴先导填词' },
    },
  ],
})

router.afterEach((to) => {
  const title = (to.meta.title as string) || 'YTBT'
  document.title = `${title} · YTBT`
})

export default router
