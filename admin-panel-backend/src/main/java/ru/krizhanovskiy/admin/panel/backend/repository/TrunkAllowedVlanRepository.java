package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.krizhanovskiy.admin.panel.backend.domain.TrunkAllowedVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.TrunkAllowedVlanId;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TrunkAllowedVlanRepository extends JpaRepository<TrunkAllowedVlan, TrunkAllowedVlanId> {

    List<TrunkAllowedVlan> findByDeviceInterface_Id(UUID interfaceId);

    @Query("""
            SELECT t FROM TrunkAllowedVlan t
            JOIN FETCH t.vlan
            WHERE t.deviceInterface.id IN :ids
            """)
    List<TrunkAllowedVlan> findAllByInterfaceIdInFetchVlan(@Param("ids") Collection<UUID> ids);
}
