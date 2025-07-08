package communicate.Friend.FriendService;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendRepositories.PersonalResourceRepository;
import communicate.Friend.FriendRepositories.PhotosRepository;
import communicate.Friend.FriendRepositories.VideosRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FileReadService {

    private final PhotosRepository photoRepository;
    private final VideosRepository videoRepository;
    private final PersonalResourceRepository resourceRepository;
    private final WebClient webClient;

    @Value("${file.repository.service.url:http://localhost:8080/files}")
    private String fileRepositoryServiceUrl;

    public Photos getPhoto(Integer id) {
        return photoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Photo not found with id: " + id));
    }

    public Videos getVideo(Integer id) {
        return videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video not found with id: " + id));
    }

    public PersonalResource getResource(Integer id) {
        return resourceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resource not found with id: " + id));
    }

    public byte[] getPhotoData(Photos photo) {
        byte[] zipData = fetchFilesFromRepository(photo.getFriend(), Collections.singletonList(photo.getPhotoName()), "photo");
        try {
            Map<String, byte[]> unzippedFiles = unzipFiles(zipData);
            return unzippedFiles.getOrDefault(photo.getPhotoName(), new byte[0]);
        } catch (IOException e) {
            throw new RuntimeException("Failed to unzip photo data for " + photo.getPhotoName(), e);
        }
    }

    public byte[] getVideoData(Videos video) {
        byte[] zipData = fetchFilesFromRepository(video.getFriend(), Collections.singletonList(video.getVideoName()), "video");
        try {
            Map<String, byte[]> unzippedFiles = unzipFiles(zipData);
            return unzippedFiles.getOrDefault(video.getVideoName(), new byte[0]);
        } catch (IOException e) {
            throw new RuntimeException("Failed to unzip video data for " + video.getVideoName(), e);
        }
    }

    public byte[] getResourceData(PersonalResource resource) {
        byte[] zipData = fetchFilesFromRepository(resource.getFriend(), Collections.singletonList(resource.getResourceName()), "resource");
        try {
            Map<String, byte[]> unzippedFiles = unzipFiles(zipData);
            return unzippedFiles.getOrDefault(resource.getResourceName(), new byte[0]);
        } catch (IOException e) {
            throw new RuntimeException("Failed to unzip resource data for " + resource.getResourceName(), e);
        }
    }

    /**
     * Fetches a list of files for a given friend from the file repository service.
     * The repository service returns the files compressed in a single ZIP archive.
     *
     * @param friend The friend context.
     * @param filenames The list of filenames to fetch.
     * @param type A string representing the type of file for logging purposes (e.g., "photo", "video").
     * @return A byte array representing the ZIP archive containing the requested files.
     */
    private byte[] fetchFilesFromRepository(Friend friend, List<String> filenames, String type) {
        if (friend == null) {
            throw new IllegalStateException("Cannot fetch " + type + " data without a friend context.");
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("friendId", friend.getId());
        requestBody.put("friendName", friend.getName());
        requestBody.put("filenames", filenames);

        try {
            byte[] zipContent = webClient
                .post()
                .uri("/files/files")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(byte[].class)
                .block(); // Use block() to maintain synchronous behavior
                
            return zipContent != null ? zipContent : new byte[0];
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Failed to fetch " + type + " files from repository service. Status: " + e.getStatusCode(), e);
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch " + type + " files from repository service", e);
        }
    }
    
    /**
     * Unzips a byte array representing a ZIP archive and returns a map of filenames to their content.
     *
     * @param zipBytes The byte array of the ZIP file.
     * @return A map where keys are filenames and values are the file contents as byte arrays.
     * @throws IOException if an I/O error occurs.
     */
    private Map<String, byte[]> unzipFiles(byte[] zipBytes) throws IOException {
        if (zipBytes == null || zipBytes.length == 0) {
            return Collections.emptyMap();
        }
        Map<String, byte[]> unzippedFiles = new HashMap<>();
        try (ByteArrayInputStream bis = new ByteArrayInputStream(zipBytes);
             ZipInputStream zis = new ZipInputStream(bis)) {
            
            ZipEntry zipEntry;
            while ((zipEntry = zis.getNextEntry()) != null) {
                if (!zipEntry.isDirectory()) {
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    byte[] buffer = new byte[1024];
                    int len;
                    while ((len = zis.read(buffer)) > 0) {
                        baos.write(buffer, 0, len);
                    }
                    unzippedFiles.put(zipEntry.getName(), baos.toByteArray());
                }
                zis.closeEntry();
            }
        }
        return unzippedFiles;
    }

    public byte[] getAllFiles(Friend friend) {
        // Step 1 & 2: Find all filenames from repositories and combine them
        List<String> allFilenames = Stream.concat(
            photoRepository.findAllByFriend(friend).stream().map(Photos::getPhotoName),
            Stream.concat(
                videoRepository.findAllByFriend(friend).stream().map(Videos::getVideoName),
                resourceRepository.findAllByFriend(friend).stream().map(PersonalResource::getResourceName)
            )
        ).collect(Collectors.toList());

        if (allFilenames.isEmpty()) {
            return new byte[0];
        }

        // Step 3: Call the fetch function
        return fetchFilesFromRepository(friend, allFilenames, "all files");
    }


    
}
