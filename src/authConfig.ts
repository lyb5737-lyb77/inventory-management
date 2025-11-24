import { Configuration, PublicClientApplication } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    auth: {
        clientId: '3ca657f9-ff46-4322-b8d3-640565067857',
        authority: 'https://login.microsoftonline.com/32b8ffa5-83e1-4600-8ef4-09d1482fceab',
        redirectUri: window.location.hostname.includes('github.io')
            ? 'https://lyb5737-lyb77.github.io/inventory-management/'
            : window.location.origin,
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
};

export const loginRequest = {
    scopes: ['User.Read', 'Sites.ReadWrite.All'],
};

// SharePoint 사이트 설정
export const sharePointConfig = {
    siteUrl: 'https://bitkr.sharepoint.com/sites/bit.kr',
    listNames: {
        items: 'InventoryItems',
        productGroups: 'ProductGroups',
        transactions: 'Transactions',
        rentals: 'RentalContracts',
    },
};

export const msalInstance = new PublicClientApplication(msalConfig);
