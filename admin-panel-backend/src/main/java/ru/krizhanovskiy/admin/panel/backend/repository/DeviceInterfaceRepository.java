package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceInterface;

import java.util.List;
import java.util.UUID;

public interface DeviceInterfaceRepository extends JpaRepository<DeviceInterface, UUID> {

    List<DeviceInterface> findByDevice_Id(UUID deviceId);
}
