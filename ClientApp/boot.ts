import './css/site.css';
import 'bootstrap';
import Vue from 'vue';
import VueRouter from 'vue-router';
Vue.use(VueRouter);
Vue.config.devtools = true;
const routes = [
    { path: '/', component: require('./components/home/home.vue.html') },
    { path: '/create', component: require('./components/create/create.vue.html') },
    { path: '/account', component: require('./components/account/account.vue.html') },
    { path: '/send', component: require('./components/send/send.vue.html') },
    { path: '/inflation', component: require('./components/inflation/inflation.vue.html') },
    { path: '/pools', component: require('./components/pools/pools.vue.html') }
];

export const EventBus = new Vue();

new Vue({
    el: '#app-root',
    router: new VueRouter({ mode: 'history', routes: routes }),
    render: h => h(require('./components/app/app.vue.html'))
});
