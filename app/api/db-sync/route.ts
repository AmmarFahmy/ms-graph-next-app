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
                // Format emails data
                const emailsToUpsert = data.map((email: any) => ({
                    user_id: userId,
                    mail_id: email.id,
                    subject: email.subject,
                    from_name: email.from.emailAddress.name,
                    from_email: email.from.emailAddress.address,
                    received_datetime: email.receivedDateTime,
                    body_preview: email.bodyPreview,
                    is_read: email.isRead,
                    to_recipients: email.toRecipients,
                    cc_recipients: email.ccRecipients
                }));

                result = await upsertEmails(emailsToUpsert);
                break;

            case 'events':
                // Format events data
                const eventsToUpsert = data.map((event: any) => ({
                    user_id: userId,
                    event_id: event.id,
                    subject: event.subject,
                    body_preview: event.bodyPreview,
                    start_datetime: event.start.dateTime,
                    end_datetime: event.end.dateTime,
                    start_timezone: event.start.timeZone,
                    end_timezone: event.end.timeZone,
                    attendees: event.attendees
                }));

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