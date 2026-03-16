package com.communicator.grpc.meetings.v1;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.62.2)",
    comments = "Source: meeting_generation.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class MeetingGenerationRpcServiceGrpc {

  private MeetingGenerationRpcServiceGrpc() {}

  public static final java.lang.String SERVICE_NAME = "communicator.meetings.v1.MeetingGenerationRpcService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest,
      com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> getGenerateMissingNextMeetingsForAllFriendsMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "GenerateMissingNextMeetingsForAllFriends",
      requestType = com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest.class,
      responseType = com.communicator.grpc.meetings.v1.GenerateMeetingsResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest,
      com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> getGenerateMissingNextMeetingsForAllFriendsMethod() {
    io.grpc.MethodDescriptor<com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest, com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> getGenerateMissingNextMeetingsForAllFriendsMethod;
    if ((getGenerateMissingNextMeetingsForAllFriendsMethod = MeetingGenerationRpcServiceGrpc.getGenerateMissingNextMeetingsForAllFriendsMethod) == null) {
      synchronized (MeetingGenerationRpcServiceGrpc.class) {
        if ((getGenerateMissingNextMeetingsForAllFriendsMethod = MeetingGenerationRpcServiceGrpc.getGenerateMissingNextMeetingsForAllFriendsMethod) == null) {
          MeetingGenerationRpcServiceGrpc.getGenerateMissingNextMeetingsForAllFriendsMethod = getGenerateMissingNextMeetingsForAllFriendsMethod =
              io.grpc.MethodDescriptor.<com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest, com.communicator.grpc.meetings.v1.GenerateMeetingsResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "GenerateMissingNextMeetingsForAllFriends"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.communicator.grpc.meetings.v1.GenerateMeetingsResponse.getDefaultInstance()))
              .setSchemaDescriptor(new MeetingGenerationRpcServiceMethodDescriptorSupplier("GenerateMissingNextMeetingsForAllFriends"))
              .build();
        }
      }
    }
    return getGenerateMissingNextMeetingsForAllFriendsMethod;
  }

  private static volatile io.grpc.MethodDescriptor<com.communicator.grpc.meetings.v1.GenerateFriendRequest,
      com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> getGenerateMissingNextMeetingsForFriendMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "GenerateMissingNextMeetingsForFriend",
      requestType = com.communicator.grpc.meetings.v1.GenerateFriendRequest.class,
      responseType = com.communicator.grpc.meetings.v1.GenerateMeetingsResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.communicator.grpc.meetings.v1.GenerateFriendRequest,
      com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> getGenerateMissingNextMeetingsForFriendMethod() {
    io.grpc.MethodDescriptor<com.communicator.grpc.meetings.v1.GenerateFriendRequest, com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> getGenerateMissingNextMeetingsForFriendMethod;
    if ((getGenerateMissingNextMeetingsForFriendMethod = MeetingGenerationRpcServiceGrpc.getGenerateMissingNextMeetingsForFriendMethod) == null) {
      synchronized (MeetingGenerationRpcServiceGrpc.class) {
        if ((getGenerateMissingNextMeetingsForFriendMethod = MeetingGenerationRpcServiceGrpc.getGenerateMissingNextMeetingsForFriendMethod) == null) {
          MeetingGenerationRpcServiceGrpc.getGenerateMissingNextMeetingsForFriendMethod = getGenerateMissingNextMeetingsForFriendMethod =
              io.grpc.MethodDescriptor.<com.communicator.grpc.meetings.v1.GenerateFriendRequest, com.communicator.grpc.meetings.v1.GenerateMeetingsResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "GenerateMissingNextMeetingsForFriend"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.communicator.grpc.meetings.v1.GenerateFriendRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.communicator.grpc.meetings.v1.GenerateMeetingsResponse.getDefaultInstance()))
              .setSchemaDescriptor(new MeetingGenerationRpcServiceMethodDescriptorSupplier("GenerateMissingNextMeetingsForFriend"))
              .build();
        }
      }
    }
    return getGenerateMissingNextMeetingsForFriendMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static MeetingGenerationRpcServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<MeetingGenerationRpcServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<MeetingGenerationRpcServiceStub>() {
        @java.lang.Override
        public MeetingGenerationRpcServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new MeetingGenerationRpcServiceStub(channel, callOptions);
        }
      };
    return MeetingGenerationRpcServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static MeetingGenerationRpcServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<MeetingGenerationRpcServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<MeetingGenerationRpcServiceBlockingStub>() {
        @java.lang.Override
        public MeetingGenerationRpcServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new MeetingGenerationRpcServiceBlockingStub(channel, callOptions);
        }
      };
    return MeetingGenerationRpcServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static MeetingGenerationRpcServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<MeetingGenerationRpcServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<MeetingGenerationRpcServiceFutureStub>() {
        @java.lang.Override
        public MeetingGenerationRpcServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new MeetingGenerationRpcServiceFutureStub(channel, callOptions);
        }
      };
    return MeetingGenerationRpcServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public interface AsyncService {

    /**
     */
    default void generateMissingNextMeetingsForAllFriends(com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest request,
        io.grpc.stub.StreamObserver<com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getGenerateMissingNextMeetingsForAllFriendsMethod(), responseObserver);
    }

    /**
     */
    default void generateMissingNextMeetingsForFriend(com.communicator.grpc.meetings.v1.GenerateFriendRequest request,
        io.grpc.stub.StreamObserver<com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getGenerateMissingNextMeetingsForFriendMethod(), responseObserver);
    }
  }

  /**
   * Base class for the server implementation of the service MeetingGenerationRpcService.
   */
  public static abstract class MeetingGenerationRpcServiceImplBase
      implements io.grpc.BindableService, AsyncService {

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return MeetingGenerationRpcServiceGrpc.bindService(this);
    }
  }

  /**
   * A stub to allow clients to do asynchronous rpc calls to service MeetingGenerationRpcService.
   */
  public static final class MeetingGenerationRpcServiceStub
      extends io.grpc.stub.AbstractAsyncStub<MeetingGenerationRpcServiceStub> {
    private MeetingGenerationRpcServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected MeetingGenerationRpcServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new MeetingGenerationRpcServiceStub(channel, callOptions);
    }

    /**
     */
    public void generateMissingNextMeetingsForAllFriends(com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest request,
        io.grpc.stub.StreamObserver<com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getGenerateMissingNextMeetingsForAllFriendsMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     */
    public void generateMissingNextMeetingsForFriend(com.communicator.grpc.meetings.v1.GenerateFriendRequest request,
        io.grpc.stub.StreamObserver<com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getGenerateMissingNextMeetingsForFriendMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   * A stub to allow clients to do synchronous rpc calls to service MeetingGenerationRpcService.
   */
  public static final class MeetingGenerationRpcServiceBlockingStub
      extends io.grpc.stub.AbstractBlockingStub<MeetingGenerationRpcServiceBlockingStub> {
    private MeetingGenerationRpcServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected MeetingGenerationRpcServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new MeetingGenerationRpcServiceBlockingStub(channel, callOptions);
    }

    /**
     */
    public com.communicator.grpc.meetings.v1.GenerateMeetingsResponse generateMissingNextMeetingsForAllFriends(com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getGenerateMissingNextMeetingsForAllFriendsMethod(), getCallOptions(), request);
    }

    /**
     */
    public com.communicator.grpc.meetings.v1.GenerateMeetingsResponse generateMissingNextMeetingsForFriend(com.communicator.grpc.meetings.v1.GenerateFriendRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getGenerateMissingNextMeetingsForFriendMethod(), getCallOptions(), request);
    }
  }

  /**
   * A stub to allow clients to do ListenableFuture-style rpc calls to service MeetingGenerationRpcService.
   */
  public static final class MeetingGenerationRpcServiceFutureStub
      extends io.grpc.stub.AbstractFutureStub<MeetingGenerationRpcServiceFutureStub> {
    private MeetingGenerationRpcServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected MeetingGenerationRpcServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new MeetingGenerationRpcServiceFutureStub(channel, callOptions);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> generateMissingNextMeetingsForAllFriends(
        com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getGenerateMissingNextMeetingsForAllFriendsMethod(), getCallOptions()), request);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<com.communicator.grpc.meetings.v1.GenerateMeetingsResponse> generateMissingNextMeetingsForFriend(
        com.communicator.grpc.meetings.v1.GenerateFriendRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getGenerateMissingNextMeetingsForFriendMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_GENERATE_MISSING_NEXT_MEETINGS_FOR_ALL_FRIENDS = 0;
  private static final int METHODID_GENERATE_MISSING_NEXT_MEETINGS_FOR_FRIEND = 1;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final AsyncService serviceImpl;
    private final int methodId;

    MethodHandlers(AsyncService serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_GENERATE_MISSING_NEXT_MEETINGS_FOR_ALL_FRIENDS:
          serviceImpl.generateMissingNextMeetingsForAllFriends((com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest) request,
              (io.grpc.stub.StreamObserver<com.communicator.grpc.meetings.v1.GenerateMeetingsResponse>) responseObserver);
          break;
        case METHODID_GENERATE_MISSING_NEXT_MEETINGS_FOR_FRIEND:
          serviceImpl.generateMissingNextMeetingsForFriend((com.communicator.grpc.meetings.v1.GenerateFriendRequest) request,
              (io.grpc.stub.StreamObserver<com.communicator.grpc.meetings.v1.GenerateMeetingsResponse>) responseObserver);
          break;
        default:
          throw new AssertionError();
      }
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public io.grpc.stub.StreamObserver<Req> invoke(
        io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        default:
          throw new AssertionError();
      }
    }
  }

  public static final io.grpc.ServerServiceDefinition bindService(AsyncService service) {
    return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
        .addMethod(
          getGenerateMissingNextMeetingsForAllFriendsMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.communicator.grpc.meetings.v1.GenerateAllFriendsRequest,
              com.communicator.grpc.meetings.v1.GenerateMeetingsResponse>(
                service, METHODID_GENERATE_MISSING_NEXT_MEETINGS_FOR_ALL_FRIENDS)))
        .addMethod(
          getGenerateMissingNextMeetingsForFriendMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.communicator.grpc.meetings.v1.GenerateFriendRequest,
              com.communicator.grpc.meetings.v1.GenerateMeetingsResponse>(
                service, METHODID_GENERATE_MISSING_NEXT_MEETINGS_FOR_FRIEND)))
        .build();
  }

  private static abstract class MeetingGenerationRpcServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    MeetingGenerationRpcServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return com.communicator.grpc.meetings.v1.MeetingGenerationProto.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("MeetingGenerationRpcService");
    }
  }

  private static final class MeetingGenerationRpcServiceFileDescriptorSupplier
      extends MeetingGenerationRpcServiceBaseDescriptorSupplier {
    MeetingGenerationRpcServiceFileDescriptorSupplier() {}
  }

  private static final class MeetingGenerationRpcServiceMethodDescriptorSupplier
      extends MeetingGenerationRpcServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final java.lang.String methodName;

    MeetingGenerationRpcServiceMethodDescriptorSupplier(java.lang.String methodName) {
      this.methodName = methodName;
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.MethodDescriptor getMethodDescriptor() {
      return getServiceDescriptor().findMethodByName(methodName);
    }
  }

  private static volatile io.grpc.ServiceDescriptor serviceDescriptor;

  public static io.grpc.ServiceDescriptor getServiceDescriptor() {
    io.grpc.ServiceDescriptor result = serviceDescriptor;
    if (result == null) {
      synchronized (MeetingGenerationRpcServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new MeetingGenerationRpcServiceFileDescriptorSupplier())
              .addMethod(getGenerateMissingNextMeetingsForAllFriendsMethod())
              .addMethod(getGenerateMissingNextMeetingsForFriendMethod())
              .build();
        }
      }
    }
    return result;
  }
}
