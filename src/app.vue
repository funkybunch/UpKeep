<template>
  <main>
    <div class="container">
      <div class="row">
        <img src="logo.svg" class="col logo">
      </div>
      <div class="row" v-if="incidents > 0" id="alert">
        <div class="col card">
          <h1><span class="indicator large error"></span>{{incidents}} Active Incident{{(incidents > 1)? 's':''}} <button class="right align large primary">View Details</button></h1>
        </div>
      </div>
      <div class="row">
        <div class="col card" id="snapshot">
          <div v-if="incidents === 0">
            <h2><font-awesome-icon class="success" icon="check-circle" /> Online</h2>
            <p>All System Operational</p>
          </div>
          <div v-else>
            <h2><font-awesome-icon class="error" icon="times-circle" /> {{incidents}} Outage{{(incidents > 1)? 's':''}}</h2>
            <p>Critical Systems Offline</p>
          </div>
        </div>
        <div class="col card" id="status-detail">
          <h2>System Status</h2>
          <h3>{{ systemStatus }}</h3>
          <div class="accordion-group" id="main-group">
            <div :class="(item.expanded === true)? 'accordion expanded':'accordion'"
                 v-for="(item, index) in status.categories"
                 :key="index">
              <div class="accordion--header"
                   tabindex="0"
                   v-on:click="toggleAccordion(item, index)">
                <span :class="(item.status === 'down')? 'accordion--indicator error':'accordion--indicator success'"></span>
                <span class="accordion--control">
                  <font-awesome-icon icon="caret-down" />
                </span>
                <h3>{{ item.name }}</h3>
              </div>
              <div class="accordion--content" v-if="status.categories[index].expanded === true">
                <div class="accordion--content-list-item"
                     v-for="(service, key) in item.services"
                     :key="key">
                  <span :class="(service.status === 'down')? 'indicator small error':'indicator small success'"></span>
                  <h4>{{ service.name }}</h4>
                  <a :href="service.url"
                     class="button right small primary"
                     v-if="service.action"
                     target="_blank"
                     rel="noreferrer">{{ service.action }}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script>
import Vue from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faCaretDown, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(faCaretDown, faCheckCircle, faTimesCircle)

Vue.component('font-awesome-icon', FontAwesomeIcon)

import axios from 'axios';

export default {
  name: "app",
  data() {
    return {
      incidents: 0,
      systemStatus: 0,
      status: []
    }
  },
  methods: {
    getStatus() {
      let self = this;
      let endpoint = './data/status.json';
      axios
          .get(endpoint)
          .then(function(response) {
            let temp = response.data;
            if(self.status.categories) {
              if(self.status.categories.length > 0){
                for(let i = 0; i < self.status.categories.length; i++) {
                  if(self.status.categories[i].expanded === true) {
                    temp.categories[i].expanded = true;
                  }
                }
              }
            }
            self.status = temp;
            self.incidents = response.data.overview.down_services_count;
            self.systemStatus = response.data.overview.system;
            self.styleCategories();
          })
          .catch(function(err) {
            console.log(err);
          })
          .then(function(){
            setTimeout(function(){
              self.getStatus()
            }, 5000);
          });
    },
    toggleAccordion(item, index) {
      if(typeof this.status.categories[index].expanded != "undefined") {
        item.expanded = !this.status.categories[index].expanded;
        Vue.set(this.status.categories, index, item);
        console.log("click toggle");
      } else {
        item.expanded = true;
        Vue.set(this.status.categories, index, item);
        console.log("click create");
      }
    },
    styleCategories() {
      for(let i = 0; i < this.status.categories.length; i++) {
        let categoryTotal = 0;
        for(let j = 0; j < this.status.categories[i].services.length; j++) {
          if(this.status.categories[i].services[j].status === "down") {
            categoryTotal++;
          }
        }
        let temp = this.status.categories[i];
        if(categoryTotal > 0) {
          temp.status = 'down';
          Vue.set(this.status.categories, i, temp);
        } else {
          temp.status = 'up';
          Vue.set(this.status.categories, i, temp);
        }
      }
    }
  },
  created() {
    this.getStatus();
  }
}
</script>

<style lang="sass" scoped>
@import 'stylesheets/style.sass'

body, html
  background-color: $theme-background-color
  color:            $theme-font-color
  margin: 0
  padding: 0

</style>
<style>
body, html {
  background-color: #0C2430;
  color:            #2D3751;
  margin: 0;
  padding: 0;
}
</style>
