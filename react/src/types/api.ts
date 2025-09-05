// filepath: c:\Users\ACER\Desktop\Java\Communicator\react\src\types\api.ts
export interface ApiResponse<T> {
    data: T;
    message: string;
    status: number;
}

export interface Friend {
    id: string;
    name: string;
    status: string;
}

export interface Group {
    id: string;
    name: string;
    members: Friend[];
}

export interface Connection {
    id: string;
    userId: string;
    friendId: string;
}

export interface ErrorResponse {
    error: string;
    status: number;
}