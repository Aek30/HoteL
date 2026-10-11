<script setup>
import {Phone,Mail,MapPin,ArrowUpRight} from 'lucide-vue-next';
const contact = {
  name: import.meta.env.VITE_HOTEL_NAME || 'HMS Hotel ปทุมธานี',
  phone: import.meta.env.VITE_HOTEL_PHONE || '02-000-0000',
  email: import.meta.env.VITE_HOTEL_EMAIL || 'contact@hms-hotel.example.com',
  address: import.meta.env.VITE_HOTEL_ADDRESS || '99/9 ถนนรังสิต–นครนายก ตำบลบึงยี่โถ อำเภอธัญบุรี จังหวัดปทุมธานี 12130',
};
const demoContact = !import.meta.env.VITE_HOTEL_PHONE || !import.meta.env.VITE_HOTEL_EMAIL || !import.meta.env.VITE_HOTEL_ADDRESS;
const members = [
  { name: 'นางสาว เอกวลี ชรินทร์', studentId: '116710906055-4' },
  { name: 'นางสาว นลินี พิมพา', studentId: '116710906069-5' },
  { name: 'นางสาว มุกศิณี อนันทสิงค์', studentId: '116710906068-7' },
];
</script>
<template><section class="contact-hero"><div class="container"><p class="eyebrow">WE ARE HERE FOR YOU</p><h1>ให้เราช่วยดูแล<br/>การเข้าพักของคุณ</h1><p>สอบถามห้องพัก การจอง หรือแจ้งความต้องการเพิ่มเติมกับโรงแรม</p></div></section><section class="container section"><div class="section-heading"><div><p class="eyebrow">HOTEL CONTACT</p><h2>{{ contact.name }}</h2><p v-if="demoContact" class="muted">ข้อมูลติดต่อสมมติสำหรับโครงงาน ไม่ใช่ช่องทางติดต่อโรงแรมจริง</p></div></div><div class="contact-grid"><article class="panel"><Phone :size="26"/><h2>โทรหาเรา</h2><a v-if="contact.phone" :href="'tel:'+contact.phone" class="text-link">{{ contact.phone }} <ArrowUpRight :size="16"/></a><p v-else class="muted">โรงแรมยังไม่ได้ระบุเบอร์โทรศัพท์</p></article><article class="panel"><Mail :size="26"/><h2>ส่งอีเมล</h2><a v-if="contact.email" :href="'mailto:'+contact.email" class="text-link">{{ contact.email }} <ArrowUpRight :size="16"/></a><p v-else class="muted">โรงแรมยังไม่ได้ระบุอีเมลติดต่อ</p></article><article class="panel"><MapPin :size="26"/><h2>ที่ตั้งโรงแรม</h2><p>{{ contact.address||'โรงแรมยังไม่ได้ระบุที่อยู่' }}</p></article></div><section class="panel group-members" aria-labelledby="group-members-title"><div class="section-heading"><div><p class="eyebrow">PROJECT TEAM</p><h2 id="group-members-title">รายชื่อสมาชิกกลุ่ม</h2><p class="muted">ผู้จัดทำโครงงานระบบจองห้องพักและจัดการโรงแรม</p></div></div><ul class="member-list"><li v-for="member in members" :key="member.studentId" class="member-card"><h3>{{ member.name }}</h3><p><span class="muted">รหัสนักศึกษา</span><br/><span class="student-id">{{ member.studentId }}</span></p></li></ul></section><div class="panel contact-help"><div><p class="eyebrow">ALREADY BOOKED?</p><h2>ติดตามการจองของคุณได้ทุกเวลา</h2><p class="muted">ดูสถานะ ส่งเอกสาร และดาวน์โหลดใบเสร็จจากหน้าการจอง</p></div><RouterLink to="/my-bookings" class="btn primary">การจองของฉัน</RouterLink></div></section></template>

<style scoped>
.group-members { margin-top: 28px; }
.group-members .section-heading { margin-bottom: 20px; }
.member-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; list-style: none; margin: 0; padding: 0; }
.member-card { border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
.member-card h3 { margin: 0 0 12px; font-size: 17px; line-height: 1.7; }
.member-card p { margin: 0; line-height: 1.8; }
.student-id { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
@media (max-width: 900px) { .member-list { grid-template-columns: 1fr; } }
</style>
