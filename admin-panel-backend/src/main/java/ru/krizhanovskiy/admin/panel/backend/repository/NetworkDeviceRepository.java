package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.krizhanovskiy.admin.panel.backend.domain.NetworkDevice;

import java.util.UUID;

public interface NetworkDeviceRepository extends JpaRepository<NetworkDevice, UUID> {
}
