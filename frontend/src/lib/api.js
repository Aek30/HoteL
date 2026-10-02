import { reactive } from 'vue';
export const session = reactive({ token: sessionStorage.getItem('hotel.token') || '', user: null, checked: false });
const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export function url(path) { return `${base}${path.startsWith('/api/') ? path.slice(4) : path}`; }
export function clearSession() { session.token = ''; session.user = null; sessionStorage.removeItem('hotel.token'); }
export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`);
  let body = options.body;
  if (body !== undefined && !(body instanceof FormData)) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(body); }
  let response;
  try { response = await fetch(url(path), { ...options, headers, body, signal: options.signal }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new Error('เชื่อมต่อระบบไม่ได้ กรุณาตรวจว่า backend เปิดอยู่แล้ว'); }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.startsWith('/auth/')) clearSession();
    const error = new Error(result.error?.message || 'ทำรายการไม่สำเร็จ'); error.status = response.status; error.code = result.error?.code; error.details = result.error?.details; throw error;
  }
  if (options.blob) return response.blob();
  return response.json();
}
export async function login(credentials) {
  const { data } = await api('/auth/login', { method: 'POST', body: credentials });
  session.token = data.access_token; session.user = data.user; session.checked = true;
  sessionStorage.setItem('hotel.token', session.token); return data.user;
}
export async function restore() {
  if (session.checked) return;
  if (session.token) { try { session.user = (await api('/me')).data; } catch { clearSession(); } }
  session.checked = true;
}
export async function download(path, filename) {
  const blob = await api(path, { blob: true }); const objectUrl = URL.createObjectURL(blob);
  const extension = { 'application/pdf':'.pdf', 'image/jpeg':'.jpg', 'image/png':'.png' }[blob.type] || '';
  const a = document.createElement('a'); a.href = objectUrl; a.download = /\.[a-z0-9]+$/i.test(filename) ? filename : filename + extension; a.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
export async function preview(path) {
  const blob = await api(path, { blob: true }); return URL.createObjectURL(blob);
}
