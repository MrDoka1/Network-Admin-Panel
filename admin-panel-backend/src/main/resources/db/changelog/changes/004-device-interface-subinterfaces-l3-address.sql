--liquibase formatted sql

--changeset admin-panel:018-device-interface-subinterface-l3-address-columns splitStatements:false
ALTER TABLE device_interface
    ADD COLUMN parent_interface_id uuid REFERENCES device_interface (id) ON DELETE CASCADE,
    ADD COLUMN dot1q_vlan_id smallint REFERENCES vlan (vlan_id) ON DELETE RESTRICT;
    ADD COLUMN ip_address inet NULL;

CREATE INDEX idx_device_interface_parent_id ON device_interface (parent_interface_id);

COMMENT ON COLUMN device_interface.parent_interface_id IS 'Родительский интерфейс для сабинтерфейса (NULL — корневой порт на устройстве; иерархия в пределах одного network_device задаётся на уровне приложения)';
COMMENT ON COLUMN device_interface.dot1q_vlan_id IS 'VLAN 802.1Q (VID), связанный с сабинтерфейсом; NULL для физического порта без тега в этой модели';
COMMENT ON COLUMN device_interface.ip_address IS 'IPv4/IPv6 и длина префикса в одном значении (тип PostgreSQL inet), например 192.168.0.1/24 или 2001:db8::1/64; NULL если адрес не задан';

ALTER TABLE device_interface
    ADD CONSTRAINT ck_device_interface_subif_not_self CHECK (parent_interface_id IS NULL OR parent_interface_id <> id);

CREATE UNIQUE INDEX uq_device_interface_parent_dot1q_vlan
    ON device_interface (parent_interface_id, dot1q_vlan_id)
    WHERE parent_interface_id IS NOT NULL AND dot1q_vlan_id IS NOT NULL;
