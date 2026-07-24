import { Connection } from '../../types/api';
import { API_BASE } from './config';

const BASE_URL = API_BASE.CONNECTIONS;

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