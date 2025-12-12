import { IPublicClientApplication, AccountInfo } from "@azure/msal-browser";

export const callMsGraph = async (instance: IPublicClientApplication, account: AccountInfo) => {
    const request = {
        scopes: ["Files.ReadWrite.All"],
        account: account
    };

    try {
        const response = await instance.acquireTokenSilent(request);
        const headers = new Headers();
        const bearer = `Bearer ${response.accessToken}`;

        headers.append("Authorization", bearer);

        const options = {
            method: "GET",
            headers: headers
        };

        const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/children", options);
        return await graphResponse.json();
    } catch (error) {
        console.error("Graph API Error:", error);
        throw error;
    }
};
