package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.krizhanovskiy.admin.panel.backend.domain.EndpointNetworkAttachment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EndpointNetworkAttachmentRepository extends JpaRepository<EndpointNetworkAttachment, UUID> {

    @EntityGraph(attributePaths = {"networkInterface", "endpointInterface"})
    @Query("SELECT a FROM EndpointNetworkAttachment a")
    List<EndpointNetworkAttachment> findAllFetched();

    @EntityGraph(attributePaths = {"networkInterface", "endpointInterface"})
    @Query("SELECT a FROM EndpointNetworkAttachment a WHERE a.id = :id")
    Optional<EndpointNetworkAttachment> findFetchedById(@Param("id") UUID id);
}
