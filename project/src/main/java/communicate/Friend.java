package communicate;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import lombok.Getter;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedList;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;


@Getter
@AllArgsConstructor
@NoArgsConstructor
public class Friend {

    private String id; // MongoDB will auto-generate this if left null

    @NotNull(message = "Name is required")
    @Size(min = 1, max = 50, message = "Name must be between 1 and 50 characters")
    private String name;

    private LocalDate lastTimeSpoken;

    @NotNull(message = "Experience is required")
    @Size(max = 100, message = "Experience description must not exceed 100 characters")
    private String experience;

    @NotNull(message = "Date of birth is required")
    @Past
    private LocalDate dateOfBirth;

    private LinkedList<String> facts;

    private HashMap<LocalDate, String> experienceHistory;

    public Friend(String name, LocalDate lastTimeSpoken, String experience, LocalDate dateOfBirth) {
        this.name = name;
        this.lastTimeSpoken = lastTimeSpoken;
        this.experience = experience;
        this.dateOfBirth = dateOfBirth;
    }
}
