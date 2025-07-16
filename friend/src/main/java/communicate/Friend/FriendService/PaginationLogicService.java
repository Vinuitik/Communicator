package communicate.Friend.FriendService;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendRepositories.PersonalResourceRepository;
import communicate.Friend.FriendRepositories.PhotosRepository;
import communicate.Friend.FriendRepositories.VideosRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PaginationLogicService {

    private final PhotosRepository photos;
    private final VideosRepository videos;
    private final PersonalResourceRepository personalResource;

    @Value("${app.media.page-size}")
    private int pageSize;

    public int calculateTotalPages(int totalItems, int itemsPerPage) {
        if (itemsPerPage <= 0) {
            throw new IllegalArgumentException("Items per page must be greater than zero.");
        }
        return (int) Math.ceil((double) totalItems / itemsPerPage);
    }

    public List<Integer> getMediaAllocations(int page){
        --page; // Adjusting page to be zero-based index
        
        if (page < 0) {
            throw new IllegalArgumentException("Page must be greater than 0");
        }

        // Calculate remaining items (ensure non-negative)
        int totalPhotos = (int) photos.count();
        int totalVideos = (int) videos.count();
        int totalResources = (int) personalResource.count();
        
        int photosCount = Math.max(0, totalPhotos - page * pageSize);
        int videosCount = Math.max(0, totalVideos - page * pageSize);
        int resourcesCount = Math.max(0, totalResources - page * pageSize);

        int totalRemainingItems = photosCount + videosCount + resourcesCount;

        // If no items remaining, return zeros
        if (totalRemainingItems == 0) {
            return List.of(0, 0, 0);
        }

        // If total remaining is less than or equal to page size, return all
        if (totalRemainingItems <= pageSize) {
            return List.of(photosCount, videosCount, resourcesCount);
        }

        // Calculate ideal allocation (equal distribution)
        int idealAllocation = pageSize / 3;

        // Start with base allocation
        int photoAlloc = Math.min(photosCount, idealAllocation);
        int videoAlloc = Math.min(videosCount, idealAllocation);
        int resourceAlloc = Math.min(resourcesCount, idealAllocation);

        // Distribute remaining slots
        int usedSlots = photoAlloc + videoAlloc + resourceAlloc;
        int remainingSlots = pageSize - usedSlots;

        // Distribute remaining slots based on availability
        if (remainingSlots > 0 && photosCount > photoAlloc) {
            int canTake = Math.min(remainingSlots, photosCount - photoAlloc);
            photoAlloc += canTake;
            remainingSlots -= canTake;
        }
        
        if (remainingSlots > 0 && videosCount > videoAlloc) {
            int canTake = Math.min(remainingSlots, videosCount - videoAlloc);
            videoAlloc += canTake;
            remainingSlots -= canTake;
        }
        
        if (remainingSlots > 0 && resourcesCount > resourceAlloc) {
            int canTake = Math.min(remainingSlots, resourcesCount - resourceAlloc);
            resourceAlloc += canTake;
        }

        return List.of(photoAlloc, videoAlloc, resourceAlloc);
    }

}
