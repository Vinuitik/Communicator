package com.communicator.chrono.service;

import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Service;

import com.communicator.chrono.config.ChronoProperties;
import com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest;
import com.communicator.grpc.meetings.v1.GenerateMeetingsResponse;
import com.communicator.grpc.meetings.v1.MeetingGenerationRpcServiceGrpc;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingGenerationGrpcClient {

    private final ChronoProperties chronoProperties;

    public int generateMissingNextMeetingsForAllFriends() {
        ChronoProperties.Grpc grpc = chronoProperties.getGrpc();
        String host = grpc != null ? grpc.getHost() : "friend";
        int port = grpc != null ? grpc.getPort() : 9091;
        int timeoutMs = grpc != null ? grpc.getTimeoutMs() : 10000;

        ManagedChannel channel = ManagedChannelBuilder
                .forAddress(host, port)
                .usePlaintext()
                .build();

        try {
            MeetingGenerationRpcServiceGrpc.MeetingGenerationRpcServiceBlockingStub stub =
                    MeetingGenerationRpcServiceGrpc.newBlockingStub(channel)
                            .withDeadlineAfter(timeoutMs, TimeUnit.MILLISECONDS);

            GenerateMeetingsResponse response = stub.generateMissingNextMeetingsForAllFriends(
                    GenerateAllFriendsRequest.newBuilder().build());

            return response.getCreatedCount();
        } finally {
            channel.shutdown();
        }
    }
}
