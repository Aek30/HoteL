const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
process.env.JWT_SECRET='test-room-types-secret-longer-than-32-characters';
const pool=require('../src/config/db');
let server,base,token,customerToken,lastSQL,params;
let item={room_type_id:10,type_name:'Test',price_per_night:'900.00',adult_capacity:2,child_capacity:3,bed_count:2,status:'inactive'};
const execute=async(sql,values)=>{
 if(sql.startsWith('SELECT user_id,username'))return [[{user_id:Number(values[0]),role:values[0]==='1'?'admin':'customer',account_status:'active'}]];
 lastSQL=sql;params=values;
 if(sql.startsWith('INSERT')){
  if(values.includes('Duplicate'))throw Object.assign(new Error(),{code:'ER_DUP_ENTRY'});
  return [{insertId:10}];
 }
 if(sql.startsWith('DELETE')){
  if(values[0]==='1')throw Object.assign(new Error(),{code:'ER_ROW_IS_REFERENCED_2'});
  return [{affectedRows:values[0]==='999'?0:1}];
 }
 if(sql.startsWith('UPDATE')){
  const fields=sql.split(' SET ')[1].split(' WHERE ')[0].split(',').map(s=>s.split('=')[0]);
  fields.forEach((k,i)=>item[k]=values[i]);return [{affectedRows:1}];
 }
 if(sql.includes('COUNT(*)'))return [[{total:1}]];
 if(sql.includes('WHERE room_type_id=?'))return [values[0]==='999'?[]:[{...item}]];
 return [[{...item}]];
};
pool.execute=execute;
pool.getConnection=async()=>({execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}});
before(async()=>{
 server=require('../src/app').listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 base=`http://127.0.0.1:${server.address().port}/api/admin/room-types`;
 const sign=id=>jwt.sign({},process.env.JWT_SECRET,{subject:id,issuer:'hotel-management-api',audience:'hotel-management-web',expiresIn:'1h'});
 token=sign('1');customerToken=sign('2');
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await pool.end();});
const request=(path='',method='GET',body,credential=token)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('all CRUD endpoints require admin',async()=>{
 for(const [method,path] of [['GET',''],['POST',''],['PATCH','/10'],['DELETE','/10']]){
  assert.equal((await request(path,method,undefined,null)).status,401);
  assert.equal((await request(path,method,undefined,customerToken)).status,403);
 }
});
test('list search uses bound SQL values and pagination',async()=>{
 const res=await request('?search=Deluxe&limit=5&page=2');assert.equal(res.status,200);
 assert.equal((await res.json()).meta.total,1);
 assert.ok(lastSQL.includes('LIMIT 5 OFFSET 5'));assert.deepEqual(params,['Deluxe']);
 assert.equal((await request('?limit=101')).status,400);
});
test('create validates data and rejects duplicate names',async()=>{
 const body={type_name:'New',price_per_night:900,adult_capacity:2};
 assert.equal((await request('','POST',body)).status,201);
 assert.equal((await request('','POST',{...body,price_per_night:-1})).status,400);
 assert.equal((await request('','POST',{...body,price_per_night:1.123})).status,400);
 assert.equal((await request('','POST',{...body,type_name:'Duplicate'})).status,409);
 assert.equal((await request('','POST',{...body,unexpected:true})).status,400);
});
test('partial patch preserves omitted fields and supports inactive status',async()=>{
 const res=await request('/10','PATCH',{price_per_night:1200});assert.equal(res.status,200);
 const data=(await res.json()).data;
 assert.equal(data.status,'inactive');assert.equal(data.child_capacity,3);assert.equal(data.bed_count,2);
 assert.equal((await request('/10','PATCH',{})).status,400);
 assert.equal((await request('/999','PATCH',{status:'inactive'})).status,404);
});
test('delete protects referenced types and handles missing IDs',async()=>{
 assert.equal((await request('/1','DELETE')).status,409);
 assert.equal((await request('/999','DELETE')).status,404);
 assert.equal((await request('/10','DELETE')).status,200);
 assert.equal((await request('/abc')).status,400);
});
