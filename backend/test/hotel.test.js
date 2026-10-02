const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const h=require('../src/lib/hotel');
after(()=>h.pool.end());
test('money calculations retain exact cents across multiple nights/payments',()=>{
 assert.equal(h.amount(h.cents('900.10')*3n),'2700.30');
 assert.equal(h.amount(h.cents('2700.30')-h.cents('900.10')),'1800.20');
 assert.equal(h.amount(-150n),'-1.50');
 for(const invalid of ['-1','1.001','NaN','1e5'])assert.equal(h.money.safeParse(invalid).success,false);
});
test('dates reject impossible calendar days and accept leap year',()=>{
 assert.equal(h.validDate('2026-02-30'),false);
 assert.equal(h.validDate('2026-02-29'),false);
 assert.equal(h.validDate('2028-02-29'),true);
 assert.equal(h.validDate('01-10-2026'),false);
});
test('ended and expired bookings cannot receive new operations',()=>{
 for(const status of ['cancelled','expired','no_show','checked_out'])assert.throws(()=>h.live({booking_status:status}),{code:'BOOKING_NOT_ACTIVE'});
 assert.throws(()=>h.live({booking_status:'pending',hold_expired:1}),{code:'BOOKING_NOT_ACTIVE'});
 assert.doesNotThrow(()=>h.live({booking_status:'confirmed'}));
});
