package communicate.Friend.Grpc;

import org.springframework.stereotype.Component;

import com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest;
import com.communicator.grpc.meetings.v1.GenerateFriendRequest;
import com.communicator.grpc.meetings.v1.GenerateMeetingsResponse;
import com.communicator.grpc.meetings.v1.MeetingGenerationRpcServiceGrpc;

import communicate.Friend.FriendService.MeetingGenerationService;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class MeetingGenerationGrpcService extends MeetingGenerationRpcServiceGrpc.MeetingGenerationRpcServiceImplBase {

    private final MeetingGenerationService meetingGenerationService;

    @Override
    public void generateMissingNextMeetingsForAllFriends(
            GenerateAllFriendsRequest request,
            StreamObserver<GenerateMeetingsResponse> responseObserver) {
        try {
            int createdCount = meetingGenerationService.generateMissingNextMeetingsForAllFriends().size();
            GenerateMeetingsResponse response = GenerateMeetingsResponse.newBuilder()
                    .setCreatedCount(createdCount)
                    .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Failed to generate meetings for all friends")
                    .withCause(e)
                    .asRuntimeException());
        }
    }

    @Override
    public void generateMissingNextMeetingsForFriend(
            GenerateFriendRequest request,
            StreamObserver<GenerateMeetingsResponse> responseObserver) {
        try {
            if (request.getFriendId() <= 0) {
                responseObserver.onError(Status.INVALID_ARGUMENT
                        .withDescription("friend_id must be > 0")
                        .asRuntimeException());
                return;
            }

            int createdCount = meetingGenerationService
                    .generateMissingNextMeetingsForFriend(request.getFriendId())
                    .size();

            GenerateMeetingsResponse response = GenerateMeetingsResponse.newBuilder()
                    .setCreatedCount(createdCount)
                    .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Failed to generate meetings for friend")
                    .withCause(e)
                    .asRuntimeException());
        }
    }
}
