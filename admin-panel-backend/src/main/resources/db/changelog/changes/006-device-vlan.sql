--liquibase formatted sql

--changeset admin-panel:020-device-vlan splitStatements:false
CREATE TABLE device_vlan (
    device_id uuid NOT NULL REFERENCES network_device (id) ON DELETE CASCADE,
    vlan_id smallint NOT NULL,
    name varchar(256),
    admin_status varchar(32) NOT NULL DEFAULT 'ACTIVE',
    oper_status varchar(32),
    CONSTRAINT pk_device_vlan PRIMARY KEY (device_id, vlan_id),
    CONSTRAINT ck_device_vlan_id_range CHECK (vlan_id >= 1 AND vlan_id <= 4094),
    CONSTRAINT ck_device_vlan_admin_status CHECK (admin_status IN ('ACTIVE', 'SUSPENDED')),
    CONSTRAINT ck_device_vlan_oper_status CHECK (oper_status IS NULL OR oper_status IN ('UP', 'DOWN', 'UNKNOWN'))
);
CREATE INDEX idx_device_vlan_device_id ON device_vlan (device_id);
COMMENT ON TABLE device_vlan IS 'VLAN, настроенные на конкретном сетевом устройстве (локальный каталог VID); отдельно от глобальной таблицы vlan';
COMMENT ON COLUMN device_vlan.vlan_id IS 'Номер VLAN (802.1Q VID) в конфигурации устройства';
COMMENT ON COLUMN device_vlan.name IS 'Имя VLAN на устройстве; может отличаться от глобального имени в vlan';
