--liquibase formatted sql

--changeset admin-panel:022-vlan-is-protected splitStatements:false
ALTER TABLE vlan ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;
