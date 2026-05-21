package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceVlanId;

public interface DeviceVlanRepository extends JpaRepository<DeviceVlan, DeviceVlanId> {
}
