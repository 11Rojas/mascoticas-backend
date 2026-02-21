let serverInstance: any;

export const setServerInstance = (server: any) => {
    serverInstance = server;
};

export const broadcastToChat = (chatId: string, data: any) => {
    if (serverInstance) {
        serverInstance.publish(chatId, JSON.stringify(data));
        console.log(`DEBUG: Broadcasted message to chat ${chatId}`);
    } else {
        console.warn('DEBUG: Cannot broadcast, serverInstance not set');
    }
};

export const broadcastGlobal = (data: any) => {
    if (serverInstance) {
        serverInstance.publish('global_presence', JSON.stringify(data));
        console.log(`DEBUG: Broadcasted global message`);
    }
};
