package communicate.Group.GroupEntities;

import jakarta.persistence.Entity;

import com.fasterxml.jackson.annotation.JsonBackReference;

import communicate.Support.Knowledge;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.ToString;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.Getter;
import lombok.experimental.SuperBuilder;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Setter
@SuperBuilder
public class GroupKnowledge extends Knowledge {

    @ManyToOne
    @JoinColumn(name = "group_id")
    @JsonBackReference
    @ToString.Exclude
    private SocialGroup group;
}
