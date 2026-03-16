package communicate.Friend.Grpc;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class GrpcServerLifecycle {

    private static final Logger logger = LoggerFactory.getLogger(GrpcServerLifecycle.class);

    private final MeetingGenerationGrpcService meetingGenerationGrpcService;

    @Value("${grpc.server.port:9091}")
    private int grpcPort;

    private Server grpcServer;

    @PostConstruct
    public void start() throws IOException {
        grpcServer = ServerBuilder
                .forPort(grpcPort)
                .addService(meetingGenerationGrpcService)
                .build()
                .start();

        logger.info("Friend gRPC server started on port {}", grpcPort);
    }

    @PreDestroy
    public void stop() {
        if (grpcServer != null) {
            grpcServer.shutdown();
            logger.info("Friend gRPC server stopped");
        }
    }
}
