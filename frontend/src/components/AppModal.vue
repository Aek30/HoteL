<script setup>
import { ref,onMounted,onUnmounted } from 'vue';import { X } from 'lucide-vue-next';
defineProps({title:String,wide:Boolean});const emit=defineEmits(['close']);const box=ref();let previous;
function key(e){if(e.key==='Escape')emit('close');if(e.key==='Tab'){const els=[...box.value.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled);if(!els.length)return;const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
onMounted(()=>{previous=document.activeElement;document.body.style.overflow='hidden';box.value.focus();document.addEventListener('keydown',key);});onUnmounted(()=>{document.body.style.overflow='';document.removeEventListener('keydown',key);previous?.focus();});
</script>
<template><Teleport to="body"><div class="modal-backdrop" @click.self="emit('close')"><section class="modal" :class="{wide}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1" ref="box"><header class="modal-header"><h2 id="dialog-title">{{ title }}</h2><button class="icon-btn" aria-label="ปิดหน้าต่าง" @click="emit('close')"><X :size="20"/></button></header><div class="modal-body"><slot/></div></section></div></Teleport></template>
