import { Connection } from '../../types/api';

const BASE_URL = '/api/connections';

export const getConnections = async (): Promise<Connection[]> => {
    // Placeholder implementation - replace with actual API call later
    return [];
};

export const createConnection = async (connection: Partial<Connection>): Promise<Connection> => {
    // Placeholder implementation - replace with actual API call later
    return { id: '1', name: 'placeholder', ...connection } as Connection;
};

export const deleteConnection = async (id: string): Promise<void> => {
    // Placeholder implementation - replace with actual API call later
    console.log('Delete connection:', id);
};