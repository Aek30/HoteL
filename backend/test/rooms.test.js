const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
process.env.JWT_SECRET='rooms-test-secret-longer-than-32-characters';
const pool=require('../src/config/db');
let server,base,token,customerToken,occupied=false,staying=false,lastQuery;
let room={room_id:10,room_number:'TEST-901',floor:9,room_type_id:1,room_status:'maintenance',note:'test'};
const execute=async(sql,values)=>{
 if(sql.startsWith('SELECT user_id,username'))return [[{user_id:Number(values[0]),role:values[0]==='1'?'admin':'customer',account_status:'active'}]];
 if(sql.startsWith('SELECT room_type_id,status'))return [values[0]===999?[]:[{room_type_id:values[0],status:values[0]===2?'inactive':'active'}]];
 if(sql.startsWith('SELECT s.stay_id'))return [staying?[{stay_id:1}]:[]];
 if(sql.startsWith('SELECT room_id'))return [values[0]==='999'?[]:[{...room,room_status:occupied?'occupied':room.room_status}]];
 if(sql.startsWith('INSERT')){
  if(values.includes('Duplicate'))throw Object.assign(new Error(),{code:'ER_DUP_ENTRY'});
  return [{insertId:10}];
 }
 if(sql.startsWith('DELETE')){
  if(values[0]==='1')throw Object.assign(new Error(),{code:'ER_ROW_IS_REFERENCED_2'});
  return [{affectedRows:1}];
 }
 if(sql.startsWith('UPDATE')){
  const keys=sql.split(' SET ')[1].split(' WHERE ')[0].split(',').map(s=>s.split('=')[0]);
  keys.forEach((k,i)=>room[k]=values[i]);return [{affectedRows:1}];
 }
 if(sql.includes('COUNT(*)'))return [[{total:1}]];
 lastQuery={sql,values};return [values[0]==='999'?[]:[{...room}]];
};
pool.execute=execute;
pool.getConnection=async()=>({execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}});
before(async()=>{
 server=require('../src/app').listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 base=`http://127.0.0.1:${server.address().port}/api/admin/rooms`;
 const sign=id=>jwt.sign({},process.env.JWT_SECRET,{subject:id,issuer:'hotel-management-api',audience:'hotel-management-web',expiresIn:'1h'});
 token=sign('1');customerToken=sign('2');
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await pool.end();});
const request=(path='',method='GET',body,credential=token)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('room CRUD requires admin on every endpoint',async()=>{
 for(const [method,path] of [['GET',''],['GET','/10'],['POST',''],['PATCH','/10'],['DELETE','/10']]){
  assert.equal((await request(path,method,undefined,null)).status,401);
  assert.equal((await request(path,method,undefined,customerToken)).status,403);
 }
});
test('search and filters are parameterized; invalid pagination rejected',async()=>{
 assert.equal((await request('?search=901&floor=9&room_type_id=1&room_status=maintenance')).status,200);
 assert.deepEqual(lastQuery.values,['901','maintenance',1,9]);
 assert.equal((await request('?limit=101')).status,400);
});
test('creation checks duplicate numbers, room type and body',async()=>{
 const body={room_number:'New',room_type_id:1};
 assert.equal((await request('','POST',body)).status,201);
 assert.equal((await request('','POST',{...body,room_type_id:999})).status,400);
 assert.equal((await request('','POST',{...body,room_type_id:2})).status,409);
 assert.equal((await request('','POST',{...body,room_number:'Duplicate'})).status,409);
 assert.equal((await request('','POST',{...body,room_status:'occupied'})).status,400);
 assert.equal((await request('','POST',{...body,unknown:1})).status,400);
});
test('partial patch preserves floor/type/status and protects active stay',async()=>{
 const res=await request('/10','PATCH',{note:'updated'});assert.equal(res.status,200);
 const data=(await res.json()).data;assert.equal(data.floor,9);assert.equal(data.room_status,'maintenance');assert.equal(data.room_type_id,1);
 assert.equal((await request('/10','PATCH',{})).status,400);
 assert.equal((await request('/999','PATCH',{note:'x'})).status,404);
 staying=true;
 try{assert.equal((await request('/10','PATCH',{room_status:'available'})).status,409);}finally{staying=false;}
 assert.equal((await request('/10','PATCH',{room_status:'cleaning'})).status,200);
});
test('delete protects booking history and occupied room',async()=>{
 assert.equal((await request('/1','DELETE')).status,409);
 occupied=true;try{assert.equal((await request('/10','DELETE')).status,409);}finally{occupied=false;}
 assert.equal((await request('/999','DELETE')).status,404);
 assert.equal((await request('/10','DELETE')).status,200);
 assert.equal((await request('/abc')).status,400);
});
