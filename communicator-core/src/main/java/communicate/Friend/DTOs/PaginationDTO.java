package communicate.Friend.DTOs;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;

import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PaginationDTO {
    List<Photos> photos;
    List<Videos> videos;
    List<PersonalResource> resources;

    // Add pagination metadata
    int currentPage;
    int totalPages;
    int totalItems;
    @Value("{app.media.page-size}") // Default page size can be set here
    int pageSize;
}
