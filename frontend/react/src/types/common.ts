// filepath: c:\Users\ACER\Desktop\Java\Communicator\react\src\types\common.ts
export type User = {
    id: string;
    name: string;
    email: string;
};

export type Pagination<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
};

export type LoadingState = {
    isLoading: boolean;
    error: string | null;
};