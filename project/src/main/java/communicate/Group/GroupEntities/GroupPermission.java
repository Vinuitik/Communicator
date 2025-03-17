package communicate.Group.GroupEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import communicate.Group.GroupEntities.SocialGroup;
import communicate.Support.Permission;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.ToString;
import lombok.Builder;

import lombok.AllArgsConstructor;
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
public class GroupPermission extends Permission{
    @ManyToOne
    @JoinColumn(name = "group_id")
    @JsonBackReference
    @ToString.Exclude
    private SocialGroup group;
}
