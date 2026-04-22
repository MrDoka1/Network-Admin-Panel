package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.krizhanovskiy.admin.panel.backend.domain.Vlan;

public interface VlanRepository extends JpaRepository<Vlan, Short> {
}
