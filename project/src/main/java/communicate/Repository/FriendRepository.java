package communicate.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.DTOs.ShortFriendDTO;
import communicate.Entities.Friend;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRepository extends JpaRepository<Friend, Integer> {
    // Custom query method (derived query)
    List<Friend> findByName(String name);

    Optional<Friend> findById(Integer id);

    // Custom query to select id and name only
    @Query("SELECT new communicate.DTOs.ShortFriendDTO(f.id, f.name) FROM Friend f")
    List<ShortFriendDTO> findAllShortFriendDTOs();
        
}