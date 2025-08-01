package communicate.Friend.FriendService;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import communicate.Friend.DTOs.PaginationDTO;
import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
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
    private final FileMetaDataReadService fileMetaDataReadService;

    @Value("${app.media.page-size}")
    private int pageSize;

    public int calculateTotalPages(int totalItems, int itemsPerPage) {
        if (itemsPerPage <= 0) {
            throw new IllegalArgumentException("Items per page must be greater than zero.");
        }
        return (int) Math.ceil((double) totalItems / itemsPerPage);
    }

    public int getPageSize() {
        return pageSize;
    }

    public int totalItems(int friendId) {
        int totalPhotos = (int) photos.countByFriendId(friendId);
        int totalVideos = (int) videos.countByFriendId(friendId);
        int totalResources = (int) personalResource.countByFriendId(friendId);
        return totalPhotos + totalVideos + totalResources;
    }

    public List<Integer> getMediaAllocations(int page, int friendId){
        --page; // Adjusting page to be zero-based index
        
        if (page < 0) {
            throw new IllegalArgumentException("Page must be greater than 0");
        }

        // Calculate remaining items (ensure non-negative)
        int totalPhotos = (int) photos.countByFriendId(friendId);
        int totalVideos = (int) videos.countByFriendId(friendId);
        int totalResources = (int) personalResource.countByFriendId(friendId);
        
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

    public List<Integer> getMediaOffsets(int page) {
        --page;
        return List.of(
            page * pageSize,
            page * pageSize,
            page * pageSize
        );
    }

    public PaginationDTO getPaginationData(int page, int friendId) {
        List<Integer> mediaAllocations = getMediaAllocations(page, friendId);
        List<Integer> mediaOffsets = getMediaOffsets(page);
        List<Photos> photos = fileMetaDataReadService.getPhotosByFriendIdWithLimitOffset(friendId, mediaOffsets.get(0), mediaAllocations.get(0));
        List<Videos> videos = fileMetaDataReadService.getVideosByFriendIdWithLimitOffset(friendId, mediaOffsets.get(1), mediaAllocations.get(1));
        List<PersonalResource> resources = fileMetaDataReadService.getResourcesByFriendIdWithLimitOffset(friendId, mediaOffsets.get(2), mediaAllocations.get(2));
        PaginationDTO dto = new PaginationDTO();
        dto.setPhotos(photos);
        dto.setVideos(videos);
        dto.setResources(resources);
        dto.setCurrentPage(page);
        dto.setPageSize(pageSize);
        dto.setTotalItems(totalItems(friendId));
        dto.setTotalPages(calculateTotalPages(dto.getTotalItems(), pageSize));
        return dto;
    }

}
