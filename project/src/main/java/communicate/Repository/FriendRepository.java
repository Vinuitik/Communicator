package communicate.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import communicate.Entities.Friend;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRepository extends JpaRepository<Friend, Integer> {
    // Custom query method (derived query)
    List<Friend> findByName(String name);

    Optional<Friend> findById(Integer id);

    @Query("SELECT f FROM Friend f WHERE " +
       "(f.lastTimeSpoken >= :mondayDate AND f.lastTimeSpoken <= :sundayDate) AND " +
       "(EXTRACT(YEAR FROM f.dateOfBirth) = :currentYear AND " +
       "f.dateOfBirth >= :mondayDate AND f.dateOfBirth <= :sundayDate)")
    List<Friend> findFriendsWithBirthdaysThisWeek(@Param("mondayDate") LocalDate mondayDate,
                                              @Param("sundayDate") LocalDate sundayDate,
                                              @Param("currentYear") int currentYear);

        
}