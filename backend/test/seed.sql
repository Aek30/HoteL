-- Sample room catalogue only. Run ONCE after 01_schema.sql.
-- All names/prices/capacities below are fictional examples, not hotel policy.
USE hotel_management;
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO room_types
 (room_type_id,type_name,description,price_per_night,adult_capacity,child_capacity,bed_count,bed_type,room_size)
VALUES
 (1,'Standard Double','ห้องมาตรฐาน เตียงคู่ขนาดใหญ่',900.00,2,1,1,'Double',24.00),
 (2,'Standard Twin','ห้องมาตรฐาน สองเตียงเดี่ยว',1000.00,2,1,2,'Twin',26.00),
 (3,'Deluxe','ห้องดีลักซ์ พื้นที่กว้างขึ้น',1500.00,2,1,1,'King',32.00),
 (4,'Family','ห้องสำหรับครอบครัว',2200.00,4,2,2,'Double',45.00);
INSERT INTO rooms (room_number,floor,room_type_id) VALUES
 ('101',1,1),('102',1,1),('103',1,2),('104',1,2),
 ('201',2,3),('202',2,3),('203',2,4),('204',2,4);
INSERT INTO amenities (amenity_id,amenity_name,icon) VALUES
 (1,'Wi-Fi','wifi'),(2,'เครื่องปรับอากาศ','air-conditioner'),
 (3,'โทรทัศน์','tv'),(4,'ตู้เย็น','refrigerator'),
 (5,'เครื่องทำน้ำอุ่น','shower'),(6,'ไดร์เป่าผม','hair-dryer');
INSERT INTO room_type_amenities (room_type_id,amenity_id) VALUES
 (1,1),(1,2),(1,3),(1,5),
 (2,1),(2,2),(2,3),(2,5),
 (3,1),(3,2),(3,3),(3,4),(3,5),(3,6),
 (4,1),(4,2),(4,3),(4,4),(4,5),(4,6);
COMMIT;
-- room_images stays empty until actual images are uploaded.
-- Register users through the backend with bcrypt/Argon2; no plaintext/demo passwords.
