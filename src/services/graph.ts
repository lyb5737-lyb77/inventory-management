import { Client } from '@microsoft/microsoft-graph-client';
import { msalInstance } from '../authConfig';

// Microsoft Graph 클라이언트 생성
export const getGraphClient = async (): Promise<Client> => {
    const account = msalInstance.getAllAccounts()[0];

    if (!account) {
        throw new Error('No account found. Please login first.');
    }

    // 액세스 토큰 획득
    const tokenResponse = await msalInstance.acquireTokenSilent({
        scopes: ['Sites.ReadWrite.All', 'Mail.Send'],
        account: account,
    });

    // Graph 클라이언트 생성
    return Client.init({
        authProvider: (done) => {
            done(null, tokenResponse.accessToken);
        },
    });
};
