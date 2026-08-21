package communicate.Friend.FriendEntities;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Beta(alpha, beta) posterior for one (context bucket, arm) cell of the
 * Thompson Sampling bandit — see BanditService. Ported from OO's raw-SQL
 * `bandit_arms` table, but as a JPA entity to match this codebase's existing
 * ORM-first convention (Hibernate ddl-auto: update creates the table, same
 * as every other entity here) rather than OO's JdbcTemplate/@PostConstruct
 * schema bootstrap.
 */
@Entity
@Table(name = "bandit_arms")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BanditArm {

    @EmbeddedId
    private BanditArmId id;

    private double alpha = 1;
    private double beta = 1;
}
