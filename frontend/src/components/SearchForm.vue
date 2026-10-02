<script setup>
import { reactive,watch } from 'vue';import { useRouter } from 'vue-router';import { Search,CalendarDays,Users } from 'lucide-vue-next';import { today,nextDate } from '../lib/format';
const props=defineProps({initial:Object});const router=useRouter();const form=reactive({check_in:today(),check_out:nextDate(today()),adults:2,children:0,...props.initial});
watch(()=>form.check_in,value=>{if(form.check_out<=value)form.check_out=nextDate(value);});
function submit(){router.push({path:'/rooms',query:{check_in:form.check_in,check_out:form.check_out,adults:form.adults,children:form.children}});}
</script>
<template><form class="search-form" @submit.prevent="submit"><label><span><CalendarDays :size="15"/> วันเข้าพัก</span><input type="date" v-model="form.check_in" :min="today()" required/></label><label><span><CalendarDays :size="15"/> วันเช็กเอาต์</span><input type="date" v-model="form.check_out" :min="nextDate(form.check_in)" required/></label><label><span><Users :size="15"/> ผู้ใหญ่</span><input type="number" v-model.number="form.adults" min="1" max="100" required/></label><label><span>เด็ก</span><input type="number" v-model.number="form.children" min="0" max="100" required/></label><button class="btn primary" type="submit"><Search :size="18"/> ค้นหาห้องพัก</button></form></template>
