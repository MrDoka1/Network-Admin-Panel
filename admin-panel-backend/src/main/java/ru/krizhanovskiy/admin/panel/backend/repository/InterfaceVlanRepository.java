package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.krizhanovskiy.admin.panel.backend.domain.InterfaceVlan;

import java.util.Optional;
import java.util.UUID;

public interface InterfaceVlanRepository extends JpaRepository<InterfaceVlan, UUID> {

    Optional<InterfaceVlan> findByDeviceInterface_Id(UUID interfaceId);

    void deleteByDeviceInterface_Id(UUID interfaceId);
}
