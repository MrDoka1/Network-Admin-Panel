package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.krizhanovskiy.admin.panel.backend.domain.Link;

import java.util.UUID;

public interface LinkRepository extends JpaRepository<Link, UUID> {

    void deleteByInterfaceA_IdOrInterfaceB_Id(UUID interfaceAId, UUID interfaceBId);
}
