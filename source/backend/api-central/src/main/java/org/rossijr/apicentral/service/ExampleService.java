package org.rossijr.apicentral.service;

import lombok.AllArgsConstructor;
import org.rossijr.apicentral.dto.UserDTO;
import org.rossijr.apicentral.mapper.UserMapper;
import org.rossijr.apicentral.repository.ExampleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@AllArgsConstructor
public class ExampleService {

    private final ExampleRepository repository;

    private final UserMapper mapper;

    public List<UserDTO> findAllUsers() {
        return repository.findAllUsers().stream().map(mapper::toDto).toList();
    }

    public UserDTO createUser(UserDTO userDto) {
        return mapper.toDto(repository.save(mapper.toEntity(userDto)));
    }

}
