package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record PortStateTrunk(InterfacePortMode mode, List<Integer> allowedVlans) {
}
