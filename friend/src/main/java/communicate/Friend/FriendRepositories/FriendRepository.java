package communicate.Friend.FriendRepositories;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import communicate.Friend.DTOs.ShortFriendDTO;
import communicate.Friend.FriendEntities.Friend;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRepository extends JpaRepository<Friend, Integer> {
    // Custom query method (derived query)
    List<Friend> findByName(String name);

    Optional<Friend> findById(Integer id);

    // Custom query to select id, name, and moving averages
    @Query("SELECT new communicate.Friend.DTOs.ShortFriendDTO(f.id, f.name, f.averageFrequency, f.averageDuration, f.averageExcitement) FROM Friend f")
    List<ShortFriendDTO> findAllShortFriendDTOs();

    // Paginated queries
    Page<Friend> findAll(Pageable pageable);
    
    @Query("SELECT new communicate.Friend.DTOs.MCP_Friend_DTO(f.id, f.name, f.dateOfBirth) FROM Friend f")
    Page<communicate.Friend.DTOs.MCP_Friend_DTO> findAllMCPFriendDTOs(Pageable pageable);
        
}