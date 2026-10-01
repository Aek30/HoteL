const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./config/db');

const app = express();

app.use(helmet());

app.use(cors({
  origin: [
    process.env.CUSTOMER_ORIGIN,
    process.env.ADMIN_ORIGIN,
  ].filter(Boolean),
}));

app.use(express.json({ limit: '1mb' }));

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

    res.json({ data: rows });
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
  console.error(error);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'ระบบเกิดข้อผิดพลาด',
    },
  });
});

module.exports = app;