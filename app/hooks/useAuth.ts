import { useState, useEffect } from 'react';
import { PublicClientApplication, AuthenticationResult, AccountInfo } from '@azure/msal-browser';
import { Client } from '@microsoft/microsoft-graph-client';
import { msalConfig, loginRequest, graphConfig } from '../utils/authConfig';

export interface UserData {
    displayName: string;
    email: string;
    photoUrl: string | null;
}

export interface EmailAddress {
    name: string;
    address: string;
}

export interface Recipient {
    emailAddress: EmailAddress;
}

export interface EmailMessage {
    id: string;
    subject: string;
    from: {
        emailAddress: EmailAddress;
    };
    toRecipients: Recipient[];
    ccRecipients: Recipient[];
    receivedDateTime: string;
    bodyPreview: string;
    isRead: boolean;
}

export interface CalendarEvent {
    id: string;
    subject: string;
    bodyPreview: string;
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    attendees: {
        emailAddress: EmailAddress;
        status: {
            response: string;
            time: string;
        };
        type: string;
    }[];
}

export const useAuth = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [emails, setEmails] = useState<EmailMessage[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [nextWeekEvents, setNextWeekEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isLoadingEmails, setIsLoadingEmails] = useState<boolean>(false);
    const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
    const [isLoadingNextWeekEvents, setIsLoadingNextWeekEvents] = useState<boolean>(false);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [currentEventsPage, setCurrentEventsPage] = useState<number>(1);
    const [currentNextWeekEventsPage, setCurrentNextWeekEventsPage] = useState<number>(1);
    const [totalEmails, setTotalEmails] = useState<number>(0);
    const [totalEvents, setTotalEvents] = useState<number>(0);
    const [totalNextWeekEvents, setTotalNextWeekEvents] = useState<number>(0);
    const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
    const [msalInstance] = useState<PublicClientApplication>(
        () => new PublicClientApplication(msalConfig)
    );

    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                await msalInstance.initialize();
                const accounts = msalInstance.getAllAccounts();
                if (accounts.length > 0) {
                    setIsAuthenticated(true);
                    await getUserData(accounts[0]);
                    await getEmails(accounts[0], 1);
                    await getEvents(accounts[0], 1);
                    await getNextWeekEvents(accounts[0], 1);
                }
            } catch (err) {
                console.error('Failed to initialize MSAL:', err);
                setError('Failed to initialize authentication');
            }
        };

        initializeAuth();
    }, [msalInstance]);

    const getGraphClient = async (account: AccountInfo) => {
        try {
            const tokenResponse = await msalInstance.acquireTokenSilent({
                ...loginRequest,
                account
            });

            return Client.initWithMiddleware({
                authProvider: {
                    getAccessToken: async () => tokenResponse.accessToken
                }
            });
        } catch (error: any) {
            console.error('Error getting token:', error);
            throw new Error('Failed to get access token');
        }
    };

    const getEmails = async (account: AccountInfo, page: number) => {
        setIsLoadingEmails(true);
        try {
            const graphClient = await getGraphClient(account);
            const skip = (page - 1) * ITEMS_PER_PAGE;

            // First, get total count
            const countResponse = await graphClient
                .api(graphConfig.graphEmailsEndpoint + '/$count')
                .get();

            const totalCount = parseInt(countResponse);
            setTotalEmails(totalCount);

            // Then get paginated emails
            const response = await graphClient
                .api(graphConfig.graphEmailsEndpoint)
                .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,isRead')
                .skip(skip)
                .top(ITEMS_PER_PAGE)
                .orderby('receivedDateTime desc')
                .get();

            setEmails(response.value);
            setCurrentPage(page);
        } catch (error: any) {
            console.error('Error fetching emails:', error);
            setError('Failed to fetch emails');
        } finally {
            setIsLoadingEmails(false);
        }
    };

    const fetchAllEvents = async (account: AccountInfo) => {
        setIsLoadingEvents(true);
        setError(null);
        try {
            const graphClient = await getGraphClient(account);
            let allCalendarEvents: CalendarEvent[] = [];
            let hasMoreEvents = true;
            let skip = 0;
            const batchSize = 50; // Fetch in larger batches for efficiency

            while (hasMoreEvents) {
                const response = await graphClient
                    .api(graphConfig.graphEventsEndpoint)
                    .select('id,subject,bodyPreview,start,end,attendees')
                    .skip(skip)
                    .top(batchSize)
                    .orderby('start/dateTime desc')
                    .get();

                const batch = response.value;
                if (!batch || batch.length === 0) {
                    hasMoreEvents = false;
                } else {
                    allCalendarEvents = [...allCalendarEvents, ...batch];
                    skip += batchSize;
                }
            }

            setAllEvents(allCalendarEvents);
            setTotalEvents(allCalendarEvents.length);
            return allCalendarEvents;
        } catch (error: any) {
            console.error('Error fetching all events:', error);
            const errorMessage = error.message || 'Failed to fetch calendar events';
            setError(errorMessage);
            setAllEvents([]);
            setTotalEvents(0);
            return [];
        } finally {
            setIsLoadingEvents(false);
        }
    };

    const getNextWeekEvents = async (account: AccountInfo, page: number) => {
        setIsLoadingNextWeekEvents(true);
        setError(null);
        try {
            const graphClient = await getGraphClient(account);

            // Calculate start and end dates for next week
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 7);

            // Format dates in ISO string format
            const startDateString = startDate.toISOString();
            const endDateString = endDate.toISOString();

            console.log('Fetching next week events with:', {
                startDateTime: startDateString,
                endDateTime: endDateString,
                endpoint: '/me/calendarview'
            });

            // Get all events for next week using calendarview endpoint
            let allNextWeekEvents: CalendarEvent[] = [];
            let hasMoreEvents = true;
            let skip = 0;
            const batchSize = 50; // Fetch in larger batches for efficiency

            while (hasMoreEvents) {
                const response = await graphClient
                    .api('/me/calendarview')
                    .query({
                        startDateTime: startDateString,
                        endDateTime: endDateString
                    })
                    .select('id,subject,bodyPreview,start,end,attendees')
                    .skip(skip)
                    .top(batchSize)
                    .orderby('start/dateTime')
                    .get();

                console.log('Next week events batch response:', response);

                const batch = response.value || [];
                if (batch.length === 0) {
                    hasMoreEvents = false;
                } else {
                    allNextWeekEvents = [...allNextWeekEvents, ...batch];
                    skip += batchSize;
                }
            }

            // Set total count for pagination
            setTotalNextWeekEvents(allNextWeekEvents.length);

            // Calculate pagination
            const startIndex = (page - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;

            // Update the events display with paginated subset
            setNextWeekEvents(allNextWeekEvents.slice(startIndex, endIndex));
            setCurrentNextWeekEventsPage(page);

            return allNextWeekEvents;
        } catch (error: any) {
            console.error('Error fetching next week events:', error);
            setError('Failed to fetch next week events');
            setNextWeekEvents([]);
            setTotalNextWeekEvents(0);
            return [];
        } finally {
            setIsLoadingNextWeekEvents(false);
        }
    };

    const getEvents = async (account: AccountInfo, page: number) => {
        try {
            let eventsToDisplay = allEvents;

            // If we haven't fetched events yet, fetch them all
            if (allEvents.length === 0) {
                eventsToDisplay = await fetchAllEvents(account);
            }

            // Calculate pagination
            const startIndex = (page - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;

            // Update the events display
            setEvents(eventsToDisplay.slice(startIndex, endIndex));
            setCurrentEventsPage(page);
        } catch (error: any) {
            console.error('Error handling events pagination:', error);
            setError('Failed to display calendar events');
            setEvents([]);
        }
    };

    const changePage = async (newPage: number) => {
        if (isAuthenticated) {
            const account = msalInstance.getAllAccounts()[0];
            await getEmails(account, newPage);
        }
    };

    const changeEventsPage = async (newPage: number) => {
        if (isAuthenticated) {
            const account = msalInstance.getAllAccounts()[0];
            await getEvents(account, newPage);
        }
    };

    const changeNextWeekEventsPage = async (newPage: number) => {
        if (isAuthenticated) {
            const account = msalInstance.getAllAccounts()[0];
            await getNextWeekEvents(account, newPage);
        }
    };

    const getUserData = async (account: AccountInfo) => {
        try {
            const graphClient = await getGraphClient(account);
            const user = await graphClient.api('/me').select('displayName,mail').get();

            let photoUrl = null;
            try {
                const photo = await graphClient.api('/me/photo/$value').get();
                photoUrl = URL.createObjectURL(photo);
            } catch (error) {
                console.log('No profile photo available');
            }

            setUserData({
                displayName: user.displayName,
                email: user.mail,
                photoUrl
            });
        } catch (error: any) {
            console.error('Error fetching user data:', error);
            setError('Failed to fetch user data');
            throw error;
        }
    };

    const signIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await msalInstance.loginPopup(loginRequest);
            console.log('Login response:', response);
            setIsAuthenticated(true);
            await getUserData(response.account);
            await getEmails(response.account, 1);
            await getEvents(response.account, 1);
            await getNextWeekEvents(response.account, 1);
        } catch (error: any) {
            console.error('Error during sign in:', error);
            setError(error.message || 'Failed to sign in');
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const signOut = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await msalInstance.logoutPopup();
            setIsAuthenticated(false);
            setUserData(null);
            setEmails([]);
            setEvents([]);
            setNextWeekEvents([]);
            setAllEvents([]); // Clear all events on sign out
            setTotalEvents(0);
            setTotalNextWeekEvents(0);
        } catch (error: any) {
            console.error('Error during sign out:', error);
            setError(error.message || 'Failed to sign out');
        } finally {
            setIsLoading(false);
        }
    };

    const syncToDatabase = async () => {
        if (!isAuthenticated || !userData) return;

        setIsSyncing(true);
        setError(null);

        try {
            const account = msalInstance.getAllAccounts()[0];
            const graphClient = await getGraphClient(account);

            // Sync Emails
            await syncEmailsToDatabase(graphClient, userData);

            // Sync Calendar Events
            await syncEventsToDatabase(graphClient, userData);

            // Sync Next Week Events
            await syncNextWeekEventsToDatabase(graphClient, userData);

            // Update the UI with success message
            setError('Database sync completed successfully!');
        } catch (error: any) {
            console.error('Error syncing to database:', error);
            setError(`Failed to sync to database: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const syncEmailsToDatabase = async (graphClient: Client, userData: UserData) => {
        let allEmails: EmailMessage[] = [];
        let hasMoreEmails = true;
        let skip = 0;
        const batchSize = 50;

        while (hasMoreEmails) {
            const response = await graphClient
                .api(graphConfig.graphEmailsEndpoint)
                .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,isRead')
                .skip(skip)
                .top(batchSize)
                .orderby('receivedDateTime desc')
                .get();

            const batch = response.value;
            if (batch.length === 0) {
                hasMoreEmails = false;
            } else {
                allEmails = [...allEmails, ...batch];
                skip += batchSize;

                // Process this batch immediately
                if (batch.length > 0) {
                    const apiResponse = await fetch('/api/db-sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'emails',
                            data: batch,
                            userId: userData.email
                        }),
                    });

                    if (!apiResponse.ok) {
                        const errorData = await apiResponse.json();
                        throw new Error(`Failed to sync emails: ${errorData.error}`);
                    }
                }
            }
        }
    };

    const syncEventsToDatabase = async (graphClient: Client, userData: UserData) => {
        // Fetch all events if not already in state
        let eventsToSync = allEvents;
        if (allEvents.length === 0) {
            const account = msalInstance.getAllAccounts()[0];
            eventsToSync = await fetchAllEvents(account);
        }

        if (eventsToSync.length > 0) {
            const apiResponse = await fetch('/api/db-sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'events',
                    data: eventsToSync,
                    userId: userData.email,
                    tableName: 'outlook_events'
                }),
            });

            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(`Failed to sync events: ${errorData.error}`);
            }
        }
    };

    const syncNextWeekEventsToDatabase = async (graphClient: Client, userData: UserData) => {
        // Get all next week's events first
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);

        const startDateString = startDate.toISOString();
        const endDateString = endDate.toISOString();

        let allNextWeekEvents: CalendarEvent[] = [];
        let hasMoreEvents = true;
        let skip = 0;
        const batchSize = 50;

        while (hasMoreEvents) {
            const response = await graphClient
                .api('/me/calendarview')
                .query({
                    startDateTime: startDateString,
                    endDateTime: endDateString
                })
                .select('id,subject,bodyPreview,start,end,attendees')
                .skip(skip)
                .top(batchSize)
                .orderby('start/dateTime')
                .get();

            const batch = response.value || [];
            if (batch.length === 0) {
                hasMoreEvents = false;
            } else {
                allNextWeekEvents = [...allNextWeekEvents, ...batch];
                skip += batchSize;

                // Process this batch immediately
                if (batch.length > 0) {
                    const apiResponse = await fetch('/api/db-sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'events',
                            data: batch,
                            userId: userData.email,
                            tableName: 'outlook_next_week_events'
                        }),
                    });

                    if (!apiResponse.ok) {
                        const errorData = await apiResponse.json();
                        throw new Error(`Failed to sync next week events: ${errorData.error}`);
                    }
                }
            }
        }
    };

    return {
        isAuthenticated,
        userData,
        emails,
        events,
        nextWeekEvents,
        isLoading,
        isLoadingEmails,
        isLoadingEvents,
        isLoadingNextWeekEvents,
        isSyncing,
        error,
        signIn,
        signOut,
        currentPage,
        currentEventsPage,
        currentNextWeekEventsPage,
        totalEmails,
        totalEvents,
        totalNextWeekEvents,
        itemsPerPage: ITEMS_PER_PAGE,
        changePage,
        changeEventsPage,
        changeNextWeekEventsPage,
        syncToDatabase
    };
};