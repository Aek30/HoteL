-- Hotel Management System: 15 tables, based on the user's report and latest ERD.
-- MySQL >= 8.0.16. Run ONCE against a new database. No DROP statements.
-- Business rules spanning rows/tables must be enforced by transactional backend code.
SET NAMES utf8mb4;
CREATE DATABASE hotel_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotel_management;

CREATE TABLE users (
 user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(50) NOT NULL UNIQUE,
 email VARCHAR(150) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role VARCHAR(20) NOT NULL DEFAULT 'customer',
 account_status VARCHAR(20) NOT NULL DEFAULT 'active',
 last_login_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CHECK (role IN ('admin','customer')),
 CHECK (account_status IN ('active','disabled'))
) ENGINE=InnoDB;

CREATE TABLE customers (
 customer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL UNIQUE,
 title VARCHAR(20),
 first_name VARCHAR(100) NOT NULL,
 last_name VARCHAR(100) NOT NULL,
 phone VARCHAR(20) NOT NULL,
 birth_date DATE,
 gender VARCHAR(20),
 address TEXT,
 province VARCHAR(100),
 postal_code VARCHAR(10),
 nationality VARCHAR(60),
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
 reset_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 token_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 expires_at DATETIME NOT NULL,
 used_at DATETIME,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(user_id),
 CHECK (expires_at > created_at)
) ENGINE=InnoDB;

CREATE TABLE room_types (
 room_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 type_name VARCHAR(100) NOT NULL UNIQUE,
 description TEXT,
 price_per_night DECIMAL(12,2) NOT NULL,
 adult_capacity INT NOT NULL,
 child_capacity INT NOT NULL DEFAULT 0,
 bed_count INT NOT NULL DEFAULT 1,
 bed_type VARCHAR(50),
 room_size DECIMAL(8,2),
 status VARCHAR(20) NOT NULL DEFAULT 'active',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CHECK (price_per_night >= 0),
 CHECK (adult_capacity > 0 AND child_capacity >= 0 AND bed_count > 0),
 CHECK (room_size IS NULL OR room_size > 0),
 CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB;

CREATE TABLE rooms (
 room_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 room_number VARCHAR(10) NOT NULL UNIQUE,
 floor INT NOT NULL DEFAULT 1,
 room_type_id INT UNSIGNED NOT NULL,
 room_status VARCHAR(20) NOT NULL DEFAULT 'available',
 note TEXT,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id),
 CHECK (room_status IN ('available','occupied','cleaning','maintenance','inactive')),
 INDEX idx_rooms_type_status (room_type_id, room_status)
) ENGINE=InnoDB;

CREATE TABLE room_images (
 image_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 room_type_id INT UNSIGNED NOT NULL,
 file_path VARCHAR(500) NOT NULL,
 description VARCHAR(255),
 is_primary BOOLEAN NOT NULL DEFAULT FALSE,
 display_order INT NOT NULL DEFAULT 0,
 primary_type_id INT UNSIGNED GENERATED ALWAYS AS
   (CASE WHEN is_primary = 1 THEN room_type_id ELSE NULL END) STORED,
 UNIQUE KEY uq_primary_image (primary_type_id),
 FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id),
 CHECK (is_primary IN (0,1)),
 CHECK (display_order >= 0)
) ENGINE=InnoDB;

CREATE TABLE amenities (
 amenity_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 amenity_name VARCHAR(100) NOT NULL UNIQUE,
 icon VARCHAR(100),
 description TEXT,
 status VARCHAR(20) NOT NULL DEFAULT 'active',
 CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB;

CREATE TABLE room_type_amenities (
 room_type_id INT UNSIGNED NOT NULL,
 amenity_id INT UNSIGNED NOT NULL,
 PRIMARY KEY (room_type_id, amenity_id),
 FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id),
 FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id)
) ENGINE=InnoDB;

CREATE TABLE bookings (
 booking_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_number VARCHAR(30) NOT NULL UNIQUE,
 customer_id INT UNSIGNED NOT NULL,
 check_in_date DATE NOT NULL,
 check_out_date DATE NOT NULL,
 adult_count INT NOT NULL DEFAULT 1,
 child_count INT NOT NULL DEFAULT 0,
 nights INT GENERATED ALWAYS AS (DATEDIFF(check_out_date,check_in_date)) STORED,
 total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Room subtotal only; sum of booking_rooms.room_total',
 booking_status VARCHAR(30) NOT NULL DEFAULT 'pending',
 special_request TEXT,
 expires_at DATETIME NULL,
 cancelled_at DATETIME NULL,
 cancelled_by INT UNSIGNED NULL,
 cancellation_reason TEXT,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
 FOREIGN KEY (cancelled_by) REFERENCES users(user_id),
 UNIQUE KEY uq_booking_customer (booking_id,customer_id),
 CHECK (check_out_date > check_in_date),
 CHECK (adult_count > 0 AND child_count >= 0 AND total_amount >= 0),
 CHECK (booking_status IN ('pending','confirmed','checked_in','checked_out','cancelled','expired','no_show')),
 CHECK (booking_status <> 'pending' OR expires_at IS NOT NULL),
 INDEX idx_booking_dates (booking_status,check_in_date,check_out_date)
) ENGINE=InnoDB;

CREATE TABLE booking_rooms (
 booking_room_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL,
 room_id INT UNSIGNED NOT NULL,
 price_per_night DECIMAL(12,2) NOT NULL COMMENT 'Price snapshot at booking time',
 nights INT NOT NULL,
 room_total DECIMAL(12,2) GENERATED ALWAYS AS (price_per_night*nights) STORED,
 adult_count INT NOT NULL DEFAULT 1,
 child_count INT NOT NULL DEFAULT 0,
 UNIQUE KEY uq_booking_room (booking_id,room_id),
 FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
 FOREIGN KEY (room_id) REFERENCES rooms(room_id),
 CHECK (price_per_night >= 0 AND nights > 0),
 CHECK (adult_count > 0 AND child_count >= 0)
) ENGINE=InnoDB;

CREATE TABLE payments (
 payment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 payment_number VARCHAR(30) NOT NULL UNIQUE,
 booking_id INT UNSIGNED NOT NULL,
 reference_number VARCHAR(100) NULL,
 amount DECIMAL(12,2) NOT NULL,
 payment_method VARCHAR(20) NOT NULL,
 proof_path VARCHAR(500),
 paid_at DATETIME NULL,
 payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
 note TEXT,
 verified_by INT UNSIGNED NULL,
 verified_at DATETIME NULL,
 refunded_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
 FOREIGN KEY (verified_by) REFERENCES users(user_id),
 UNIQUE KEY uq_payment_reference (payment_method,reference_number),
 UNIQUE KEY uq_payment_booking (payment_id,booking_id),
 CHECK (amount > 0),
 CHECK (payment_method IN ('cash','bank_transfer','promptpay')),
 CHECK (payment_status IN ('pending','successful','failed','refunded')),
 CHECK (payment_status NOT IN ('successful','refunded') OR (paid_at IS NOT NULL AND verified_at IS NOT NULL AND verified_by IS NOT NULL)),
 CHECK (payment_status <> 'refunded' OR refunded_at IS NOT NULL),
 INDEX idx_payment_report (payment_status,paid_at)
) ENGINE=InnoDB;

CREATE TABLE identity_documents (
 document_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL,
 customer_id INT UNSIGNED NOT NULL,
 document_type VARCHAR(20) NOT NULL,
 document_number VARCHAR(30) NULL COMMENT 'Masked identifier only; do not store full ID here',
 file_path VARCHAR(500) NOT NULL COMMENT 'Private storage key; not a public URL',
 document_status VARCHAR(20) NOT NULL DEFAULT 'pending',
 review_note TEXT,
 reviewed_by INT UNSIGNED NULL,
 uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at DATETIME NULL,
 FOREIGN KEY (booking_id,customer_id) REFERENCES bookings(booking_id,customer_id),
 FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
 FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
 CHECK (document_type IN ('national_id','passport')),
 CHECK (document_status IN ('pending','approved','rejected')),
 CHECK (document_status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE stays (
 stay_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL UNIQUE,
 actual_check_in DATETIME NOT NULL,
 actual_check_out DATETIME NULL,
 check_in_by INT UNSIGNED NOT NULL,
 check_out_by INT UNSIGNED NULL,
 note TEXT,
 FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
 FOREIGN KEY (check_in_by) REFERENCES users(user_id),
 FOREIGN KEY (check_out_by) REFERENCES users(user_id),
 CHECK (actual_check_out IS NULL OR actual_check_out >= actual_check_in),
 CHECK ((actual_check_out IS NULL AND check_out_by IS NULL) OR (actual_check_out IS NOT NULL AND check_out_by IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE additional_charges (
 charge_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 stay_id INT UNSIGNED NOT NULL,
 charge_name VARCHAR(150) NOT NULL,
 quantity INT NOT NULL DEFAULT 1,
 unit_price DECIMAL(12,2) NOT NULL,
 total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity*unit_price) STORED,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_by INT UNSIGNED NOT NULL,
 note TEXT,
 FOREIGN KEY (stay_id) REFERENCES stays(stay_id),
 FOREIGN KEY (created_by) REFERENCES users(user_id),
 CHECK (quantity > 0 AND unit_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE receipts (
 receipt_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 receipt_number VARCHAR(30) NOT NULL UNIQUE,
 booking_id INT UNSIGNED NOT NULL,
 payment_id INT UNSIGNED NOT NULL UNIQUE,
 issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 room_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 additional_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 net_amount DECIMAL(12,2) GENERATED ALWAYS AS (room_amount+additional_amount) STORED,
 pdf_path VARCHAR(500),
 issued_by INT UNSIGNED NOT NULL,
 FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
 FOREIGN KEY (payment_id,booking_id) REFERENCES payments(payment_id,booking_id),
 FOREIGN KEY (issued_by) REFERENCES users(user_id),
 CHECK (room_amount >= 0 AND additional_amount >= 0),
 CHECK (room_amount+additional_amount > 0)
) ENGINE=InnoDB;

-- Deliberately no hard-coded accounts/passwords, triggers, or application credentials.
-- One payment -> at most one receipt. Issue only after successful payment.
-- Additional charges reach bookings via stays, as in the latest ER diagram.
