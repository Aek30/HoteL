const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./config/db');
const authRoutes = require('./modules/auth/auth.routes');
const authenticate = require('./middleware/authenticate');

const app = express();

app.use(helmet());

app.use(cors({
  origin: [
    process.env.CUSTOMER_ORIGIN,
    process.env.ADMIN_ORIGIN,
  ].filter(Boolean),
}));

app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use('/api', require('./modules/bookings/bookings.routes'));
app.use('/api', require('./modules/bookings/payments.routes'));
app.use('/api', require('./modules/bookings/documents.routes'));
app.use('/api/admin', require('./modules/bookings/stays.routes'));
app.use('/api', require('./modules/bookings/reports.routes'));
app.use('/api', require('./modules/bookings/catalog.routes'));
app.use('/api/rooms', require('./modules/rooms/availability.routes'));
app.use('/api/admin/rooms', require('./modules/rooms/rooms.routes'));
app.use('/api/admin/room-types', require('./modules/room-types/room-types.routes'));
app.get('/api/me', authenticate, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ data: {
    user_id: req.user.user_id, username: req.user.username,
    email: req.user.email, role: req.user.role,
  } });
});

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.execute('SELECT 1');

    res.json({
      data: {
        status: 'ok',
        database: 'connected',
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/room-types', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         room_type_id,
         type_name,
         description,
         price_per_night,
         adult_capacity,
         child_capacity,
         bed_type,
         room_size
       FROM room_types
       WHERE status = ?
       ORDER BY price_per_night`,
      ['active']
    );

    const [images] = await pool.execute('SELECT image_id,room_type_id FROM room_images ORDER BY is_primary DESC,display_order,image_id');
    const firstImages = new Map();
    for (const image of images) if (!firstImages.has(image.room_type_id)) firstImages.set(image.room_type_id, image.image_id);
    res.json({ data: rows.map(row => ({...row, image_url: firstImages.has(row.room_type_id) ? `/api/room-images/${firstImages.get(row.room_type_id)}/file` : null})) });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'ไม่พบ API ที่เรียก',
    },
  });
});

app.use((error, req, res, next) => {
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.name === 'MulterError' ? 400 : error.status || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    error: {
      code: status >= 500
        ? 'INTERNAL_ERROR'
        : error.code || 'REQUEST_ERROR',

      message: status >= 500
        ? 'ระบบเกิดข้อผิดพลาด'
        : error.message,
    },
  });
});

module.exports = app;