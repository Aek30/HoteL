const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { fail } = require('./hotel');
const root = path.resolve(__dirname, '../../private-storage');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 } }).single('file');
function detect(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  throw fail(400, 'INVALID_FILE', 'รองรับเฉพาะ PNG, JPEG และ PDF');
}
async function save(file) {
  if (!file) throw fail(400, 'FILE_REQUIRED', 'กรุณาแนบไฟล์ช่อง file');
  const ext = detect(file.buffer), key = `${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(root, { recursive: true }); await fs.writeFile(path.join(root, key), file.buffer, { flag: 'wx' }); return key;
}
async function remove(key) { if (key) await fs.unlink(resolve(key)).catch(() => {}); }
function resolve(key) {
  if (!/^[a-f0-9-]{36}\.(png|jpg|pdf)$/.test(key || '')) throw fail(404, 'FILE_NOT_FOUND', 'ไม่พบไฟล์');
  return path.join(root, key);
}
module.exports = { upload, save, remove, resolve, detect };
