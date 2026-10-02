const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
  throw new Error('กรุณาตั้ง JWT_SECRET ที่มีความยาวอย่างน้อย 32 bytes ใน backend/.env');
}

const app = require('./app');
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
const { expire } = require('./lib/hotel');
const expirationTimer = setInterval(() => expire().catch(error => console.error('Expiration failed:', error.code || error.name)), 60000);
expirationTimer.unref();
