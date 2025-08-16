package org.rossijr.apicentral.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record ProgramCardResumoDTO(
        UUID id,
        String title,
        String sector,
        String criminalFocus,
        LocalDateTime shiftStart,
        LocalDateTime shiftEnd,
        boolean active
) {}