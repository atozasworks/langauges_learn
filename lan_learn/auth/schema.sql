-- ============================================
-- Authentication System Database Schema
-- Run this in phpMyAdmin or MySQL CLI
-- ============================================

CREATE DATABASE IF NOT EXISTS `atozservices_auth`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `atozservices_auth`;

-- ----------------------------------------
-- 1. Users table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `email`           VARCHAR(255)    NOT NULL,
  `name`            VARCHAR(255)    DEFAULT NULL,
  `auth_provider`   ENUM('google','email_otp','both') NOT NULL DEFAULT 'email_otp',
  `google_sub`      VARCHAR(255)    DEFAULT NULL,
  `profile_picture` VARCHAR(500)    DEFAULT NULL,
  `is_verified`     TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login_at`   DATETIME        DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`),
  UNIQUE KEY `uq_google_sub` (`google_sub`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------
-- 2. Email OTPs table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `email_otps` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `email`       VARCHAR(255)    NOT NULL,
  `otp_hash`    VARCHAR(255)    NOT NULL,
  `expires_at`  DATETIME        NOT NULL,
  `used_at`     DATETIME        DEFAULT NULL,
  `attempts`    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `ip_address`  VARCHAR(45)     NOT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_expires` (`email`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------
-- 3. Login audit table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `login_audit` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED    NOT NULL,
  `method`      VARCHAR(20)     NOT NULL,
  `ip_address`  VARCHAR(45)     NOT NULL,
  `user_agent`  VARCHAR(500)    DEFAULT NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------
-- 4. Rate-limiting table for OTP requests
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `otp_rate_limits` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `identifier`  VARCHAR(255)    NOT NULL COMMENT 'email or IP address',
  `request_time` DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_identifier_time` (`identifier`, `request_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
