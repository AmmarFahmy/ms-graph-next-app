import { Configuration, PopupRequest } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    auth: {
        clientId: '163c60b7-7d2e-441f-b605-db4b3291e6d1',
        authority: 'https://login.microsoftonline.com/77e3b5a4-521b-4caf-a71c-1f4d9d0d549e',
        redirectUri: 'http://localhost:3000'
    }
};

export const loginRequest: PopupRequest = {
    scopes: ['user.read', 'Mail.Read', 'Calendars.Read']
};

export const graphConfig = {
    graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
    graphPhotoEndpoint: 'https://graph.microsoft.com/v1.0/me/photo/$value',
    graphEmailsEndpoint: 'https://graph.microsoft.com/v1.0/me/messages',
    graphEventsEndpoint: 'https://graph.microsoft.com/v1.0/me/events'
}; 