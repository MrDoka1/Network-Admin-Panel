--liquibase formatted sql

--changeset admin-panel:007-endpoint-device splitStatements:false
CREATE TABLE endpoint_device (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname varchar(255) NOT NULL,
    status varchar(32) NOT NULL,
    CONSTRAINT ck_endpoint_device_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
COMMENT ON TABLE endpoint_device IS 'Оконечное устройство (хост, принтер и т.д.); не сетевой коммутатор/маршрутизатор';

--changeset admin-panel:008-endpoint-device-interface splitStatements:false
CREATE TABLE endpoint_device_interface (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_device_id uuid NOT NULL REFERENCES endpoint_device (id) ON DELETE CASCADE,
    name varchar(128) NOT NULL,
    mac_address varchar(32) NOT NULL,
    admin_status varchar(16) NOT NULL,
    CONSTRAINT ck_endpoint_device_interface_admin_status CHECK (admin_status IN ('UP', 'DOWN')),
    CONSTRAINT uq_endpoint_device_interface_device_name UNIQUE (endpoint_device_id, name),
    CONSTRAINT uq_endpoint_device_interface_mac UNIQUE (mac_address)
);
CREATE INDEX idx_endpoint_device_interface_device_id ON endpoint_device_interface (endpoint_device_id);
COMMENT ON TABLE endpoint_device_interface IS 'Интерфейс оконечного устройства (MAC на NIC)';
COMMENT ON COLUMN endpoint_device_interface.mac_address IS 'Глобально уникальный MAC интерфейса';

--changeset admin-panel:009-endpoint-network-attachment splitStatements:false
CREATE TABLE endpoint_network_attachment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network_interface_id uuid NOT NULL REFERENCES device_interface (id) ON DELETE CASCADE,
    endpoint_interface_id uuid NOT NULL REFERENCES endpoint_device_interface (id) ON DELETE CASCADE,
    CONSTRAINT uq_endpoint_network_attachment_network_if UNIQUE (network_interface_id),
    CONSTRAINT uq_endpoint_network_attachment_endpoint_if UNIQUE (endpoint_interface_id)
);
CREATE INDEX idx_endpoint_network_attachment_network_if ON endpoint_network_attachment (network_interface_id);
CREATE INDEX idx_endpoint_network_attachment_endpoint_if ON endpoint_network_attachment (endpoint_interface_id);
COMMENT ON TABLE endpoint_network_attachment IS 'Подключение NIC оконечного устройства к порту сетевого устройства (дополняет link между infrastructure-интерфейсами)';
