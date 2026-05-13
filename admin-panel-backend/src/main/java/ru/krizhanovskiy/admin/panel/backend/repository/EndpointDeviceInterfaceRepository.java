package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.krizhanovskiy.admin.panel.backend.domain.EndpointDeviceInterface;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EndpointDeviceInterfaceRepository extends JpaRepository<EndpointDeviceInterface, UUID> {

    @EntityGraph(attributePaths = {"attachment", "attachment.networkInterface"})
    List<EndpointDeviceInterface> findByEndpointDevice_Id(UUID endpointDeviceId);

    @EntityGraph(attributePaths = {"attachment", "attachment.networkInterface"})
    @Query("SELECT e FROM EndpointDeviceInterface e WHERE e.id = :id")
    Optional<EndpointDeviceInterface> findFetchedById(@Param("id") UUID id);
}
