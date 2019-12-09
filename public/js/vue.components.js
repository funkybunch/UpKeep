// Category Status Accordion
Vue.component('accordion', {
    data: function () {
        return {
            name: 0
        }
    },
    template: '<button v-on:click="count++">You clicked me {{ count }} times.</button>'
})