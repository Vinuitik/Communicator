package communicate.Entities;

import java.time.LocalDate;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Data;

@Entity
@Data
public class Analytics {

    @Id
    private Integer id;
    
    private String experience;

    private LocalDate date;

    private Integer hours;

    @ManyToOne
    @JoinColumn(name = "friend_id")
    private Friend friend;
}
