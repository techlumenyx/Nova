-- Creates a separate PostgreSQL schema for each service
-- Runs automatically on first postgres container boot

CREATE SCHEMA IF NOT EXISTS nova_auth;
CREATE SCHEMA IF NOT EXISTS profile;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS chat;
CREATE SCHEMA IF NOT EXISTS content;
