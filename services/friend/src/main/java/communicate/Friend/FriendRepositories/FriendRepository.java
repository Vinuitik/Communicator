package communicate.Friend.FriendRepositories;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import communicate.Friend.DTOs.ShortFriendDTO;
import communicate.Friend.FriendEntities.Friend;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRepository extends JpaRepository<Friend, Integer> {
    // Custom query method (derived query). Excludes bin — same reasoning as
    // the other list queries below.
    List<Friend> findByNameAndDeletedAtIsNull(String name);

    // Unfiltered on purpose — restore, purge, and cross-module id lookups
    // (e.g. a meeting's friend name) all need to resolve a friend regardless
    // of bin state. Only LIST/SEARCH queries below exclude deleted_at.
    Optional<Friend> findById(Integer id);

    // Custom query to select id, name, and moving averages
    @Query("SELECT new communicate.Friend.DTOs.ShortFriendDTO(f.id, f.name, f.averageFrequency, f.averageDuration, f.averageExcitement, f.averageProximity, f.experience) FROM Friend f WHERE f.deletedAt IS NULL")
    List<ShortFriendDTO> findAllShortFriendDTOs();

    // Paginated queries
    @Query("SELECT f FROM Friend f WHERE f.deletedAt IS NULL")
    Page<Friend> findAll(Pageable pageable);

    @Query("SELECT new communicate.Friend.DTOs.MCP_Friend_DTO(f.id, f.name, f.dateOfBirth) FROM Friend f WHERE f.deletedAt IS NULL")
    Page<communicate.Friend.DTOs.MCP_Friend_DTO> findAllMCPFriendDTOs(Pageable pageable);

    // Flashcard-review folder list (ReviewPage's default view) — every
    // currently-starred friend.
    List<Friend> findByFlashcardsEnabledTrueAndDeletedAtIsNull();

    // Default (non-paginated) listing — excludes bin.
    List<Friend> findByDeletedAtIsNull();

    // Bin view.
    List<Friend> findByDeletedAtIsNotNull();

    // PurgeService: everything soft-deleted more than 7 days ago.
    List<Friend> findByDeletedAtBefore(LocalDateTime cutoff);

}