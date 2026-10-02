const path = require('path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');
const { registerSchema } = require('../src/modules/auth/auth.validation');
async function main(){
 const parsed=registerSchema.pick({username:true,email:true,password:true}).safeParse({username:process.env.ADMIN_USERNAME,email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});
 if(!parsed.success)throw new Error('ตั้ง ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD ให้ตรงเงื่อนไขสมัครสมาชิกใน .env');
 const {username,email,password}=parsed.data;
 const hash=await bcrypt.hash(password,12);
 await pool.execute("INSERT INTO users (username,email,password_hash,role,account_status) VALUES (?,?,?,'admin','active')",[username,email,hash]);
 console.log('สร้างบัญชี admin สำเร็จ');
}
main().catch(error=>{console.error(error.code==='ER_DUP_ENTRY'?'ชื่อหรืออีเมลนี้มีอยู่แล้ว ไม่ได้เปลี่ยนบัญชีเดิม':error.code||error.message);process.exitCode=1;}).finally(()=>pool.end());
