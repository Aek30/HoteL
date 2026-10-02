import { ref } from 'vue';
export const notices = ref([]);
export function notify(message, kind = 'success') {
  const id = Date.now() + Math.random(); notices.value.push({ id, message, kind }); setTimeout(() => { notices.value = notices.value.filter(n => n.id !== id); }, 5000);
}
