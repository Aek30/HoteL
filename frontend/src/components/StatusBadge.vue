<script setup>import { label } from '../lib/format'; defineProps({ value:String });</script>
<template><span class="badge" :class="value"><span class="badge-dot"></span>{{ label(value) }}</span></template>
