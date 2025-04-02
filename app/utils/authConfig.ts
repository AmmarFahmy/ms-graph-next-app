import { Configuration, PopupRequest } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    // auth: {
    //     clientId: 'ed7d50c7-d4e0-4fa3-ab44-04e8e1b7093b',
    //     authority: 'https://login.microsoftonline.com/77e3b5a4-521b-4caf-a71c-1f4d9d0d549e',
    //     redirectUri: 'https://meta-self-next-app.vercel.app'
    // }

    // just to test multi tanent .. revoke later
    auth: {
        clientId: '00d53d9f-8a3e-4853-9f6b-180e60071b84',
        // authority: 'https://login.microsoftonline.com/77e3b5a4-521b-4caf-a71c-1f4d9d0d549e',
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: 'https://meta-self-next-app.vercel.app'
    }

    // when running locally, comment out the above and uncomment the below

    // auth: {
    //     clientId: '163c60b7-7d2e-441f-b605-db4b3291e6d1',
    //     authority: 'https://login.microsoftonline.com/77e3b5a4-521b-4caf-a71c-1f4d9d0d549e',
    //     redirectUri: 'http://localhost:3000'
    // }
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