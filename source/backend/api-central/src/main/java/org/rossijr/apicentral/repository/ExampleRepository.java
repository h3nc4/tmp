package org.rossijr.apicentral.repository;

import org.rossijr.apicentral.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * This is an example repository interface for the User entity.
 * It extends JpaRepository to provide CRUD operations.
 * You can add custom query methods as needed.
 * To reproduce the controller for another entity, create a new repository interface with the same structure,
 * but replace the entity type and ID type accordingly.
 */
@Repository
public interface ExampleRepository extends JpaRepository<User, UUID> {

    @Query(value = """
                select u from User u
            """)
    List<User> findAllUsers();


}
