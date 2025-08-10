package org.rossijr.apicentral.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UserDTO {
    private String id;

    @NotEmpty
    private String name;

    @NotEmpty
    private String rank;

    @NotNull
    private boolean isManager;

    private String programCardId;
}
