import { createRouter, createWebHistory } from 'vue-router';
import { session, restore } from './lib/api';
const router = createRouter({ history: createWebHistory(), scrollBehavior: () => ({ top: 0 }), routes: [
  { path:'/', component:()=>import('./views/Home.vue'), meta:{ title:'หน้าหลัก' } },
  { path:'/rooms', component:()=>import('./views/Rooms.vue'), meta:{ title:'ห้องพัก' } },
  { path:'/rooms/:id', component:()=>import('./views/RoomDetail.vue'), meta:{ title:'รายละเอียดห้อง' } },
  { path:'/login', component:()=>import('./views/Auth.vue'), meta:{ title:'เข้าสู่ระบบ' } },
  { path:'/register', component:()=>import('./views/Auth.vue'), meta:{ title:'สมัครสมาชิก' } },
  { path:'/forgot-password', component:()=>import('./views/Auth.vue'), meta:{ title:'ลืมรหัสผ่าน' } },
  { path:'/reset-password', component:()=>import('./views/Auth.vue'), meta:{ title:'ตั้งรหัสผ่านใหม่' } },
  { path:'/booking', component:()=>import('./views/Booking.vue'), meta:{ auth:true,customer:true,title:'จองห้องพัก' } },
  { path:'/my-bookings', component:()=>import('./views/MyBookings.vue'), meta:{ auth:true,customer:true,title:'การจองของฉัน' } },
  { path:'/bookings/:id', component:()=>import('./views/BookingDetail.vue'), meta:{ auth:true,title:'รายละเอียดการจอง' } },
  { path:'/profile', component:()=>import('./views/Profile.vue'), meta:{ auth:true,customer:true,title:'ข้อมูลส่วนตัว' } },
  { path:'/contact', component:()=>import('./views/Contact.vue'), meta:{ title:'ติดต่อเรา' } },
  { path:'/admin', component:()=>import('./views/AdminDashboard.vue'), meta:{ auth:true,admin:true,title:'ภาพรวมโรงแรม' } },
  { path:'/admin/room-types', component:()=>import('./views/AdminCatalog.vue'), meta:{ auth:true,admin:true,title:'ประเภทห้อง' } },
  { path:'/admin/rooms', component:()=>import('./views/AdminCatalog.vue'), meta:{ auth:true,admin:true,title:'ห้องพักทั้งหมด' } },
  { path:'/admin/amenities', component:()=>import('./views/AdminCatalog.vue'), meta:{ auth:true,admin:true,title:'สิ่งอำนวยความสะดวก' } },
  { path:'/admin/bookings', component:()=>import('./views/MyBookings.vue'), meta:{ auth:true,admin:true,title:'จัดการการจอง' } },
  { path:'/admin/payments', component:()=>import('./views/AdminReviews.vue'), meta:{ auth:true,admin:true,title:'ตรวจการชำระเงิน' } },
  { path:'/admin/documents', component:()=>import('./views/AdminReviews.vue'), meta:{ auth:true,admin:true,title:'ตรวจเอกสาร' } },
  { path:'/admin/reports', component:()=>import('./views/AdminReports.vue'), meta:{ auth:true,admin:true,title:'รายงาน' } },
  { path:'/:pathMatch(.*)*', component:()=>import('./views/NotFound.vue'), meta:{ title:'ไม่พบหน้า' } },
] });
router.beforeEach(async to => {
  await restore();
  if (to.meta.auth && !session.user) return { path:'/login',query:{redirect:to.fullPath} };
  if (to.meta.admin && session.user?.role !== 'admin') return '/';
  if (to.meta.customer && session.user?.role === 'admin') return '/admin';
});
router.afterEach(to => { document.title = `${to.meta.title || 'HMS'} · HMS Hotel`; });
export default router;
