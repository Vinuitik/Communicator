package communicate.Entities;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class GroupMember {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    Integer id; // I think we need to replace it into unique id of GROUP, FRIEND
}
