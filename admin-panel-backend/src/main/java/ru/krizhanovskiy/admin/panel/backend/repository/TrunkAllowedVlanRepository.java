package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.krizhanovskiy.admin.panel.backend.domain.TrunkAllowedVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.TrunkAllowedVlanId;

import java.util.List;
import java.util.UUID;

public interface TrunkAllowedVlanRepository extends JpaRepository<TrunkAllowedVlan, TrunkAllowedVlanId> {

    List<TrunkAllowedVlan> findByDeviceInterface_Id(UUID interfaceId);
}
