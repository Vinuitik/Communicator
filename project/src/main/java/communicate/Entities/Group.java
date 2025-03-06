package communicate.Entities;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.util.LinkedList;
import java.util.List;
import jakarta.persistence.OneToMany;

@Entity
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private String name;

    private String description;

    @OneToMany
    private List<GroupKnowledge> knowledge;

    @OneToMany
    private List<GroupMember> members;
}
