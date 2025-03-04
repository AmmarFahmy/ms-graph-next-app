import { NextResponse } from 'next/server';
import { upsertEmails, upsertEvents } from '../../utils/neondb';

export async function POST(request: Request) {
    try {
        const { type, data, userId, tableName } = await request.json();

        if (!type || !data || !userId) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        let result;

        switch (type) {
            case 'emails':
                // Format emails data with proper null checks
                const emailsToUpsert = data.map((email: any) => {
                    // Add defensive checks for all properties
                    const fromName = email.from?.emailAddress?.name || 'Unknown';
                    const fromEmail = email.from?.emailAddress?.address || 'unknown@example.com';

                    // Ensure toRecipients and ccRecipients are arrays
                    const toRecipients = Array.isArray(email.toRecipients) ? email.toRecipients : [];
                    const ccRecipients = Array.isArray(email.ccRecipients) ? email.ccRecipients : [];

                    return {
                        user_id: userId,
                        mail_id: email.id || `unknown-${Date.now()}-${Math.random()}`,
                        subject: email.subject || 'No Subject',
                        from_name: fromName,
                        from_email: fromEmail,
                        received_datetime: email.receivedDateTime || new Date().toISOString(),
                        body_preview: email.bodyPreview || '',
                        is_read: !!email.isRead,
                        to_recipients: toRecipients,
                        cc_recipients: ccRecipients
                    };
                });

                result = await upsertEmails(emailsToUpsert);
                break;

            case 'events':
                // Format events data with proper null checks
                const eventsToUpsert = data.map((event: any) => {
                    // Add defensive checks for all properties
                    const startDateTime = event.start?.dateTime || new Date().toISOString();
                    const endDateTime = event.end?.dateTime || new Date().toISOString();
                    const startTimeZone = event.start?.timeZone || 'UTC';
                    const endTimeZone = event.end?.timeZone || 'UTC';
                    const attendees = Array.isArray(event.attendees) ? event.attendees : [];

                    return {
                        user_id: userId,
                        event_id: event.id || `unknown-${Date.now()}-${Math.random()}`,
                        subject: event.subject || 'No Subject',
                        body_preview: event.bodyPreview || '',
                        start_datetime: startDateTime,
                        end_datetime: endDateTime,
                        start_timezone: startTimeZone,
                        end_timezone: endTimeZone,
                        attendees: attendees
                    };
                });

                result = await upsertEvents(eventsToUpsert, tableName || 'outlook_events');
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid data type' },
                    { status: 400 }
                );
        }

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in DB sync API:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to sync data' },
            { status: 500 }
        );
    }
} 