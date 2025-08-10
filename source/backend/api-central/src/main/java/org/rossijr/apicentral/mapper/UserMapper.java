package org.rossijr.apicentral.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.rossijr.apicentral.dto.UserDTO;
import org.rossijr.apicentral.entity.User;

@Mapper(componentModel = "spring")
public interface UserMapper extends BaseMapper<User, UserDTO> {

    @Override
    @Mapping(source = "programCardAssigned.id", target = "programCardId")
    UserDTO toDto(User entity);

    @Override
    @Mapping(target = "id", ignore = true)
    User toEntity(UserDTO dto);
}
