'use client';

import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Image from 'next/image';
import styles from './page.module.css';
import { EmailAddress, Recipient, CalendarEvent } from './hooks/useAuth';
import KnowledgeBase from './components/KnowledgeBase';
import Assistant from './components/Assistant';

function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRecipients(recipients: Recipient[]) {
    return recipients.map(r => `${r.emailAddress.name} <${r.emailAddress.address}>`).join(', ');
}

function formatEventDate(dateTime: string, timeZone: string) {
    const date = new Date(dateTime);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone
    });
}

function formatAttendees(attendees: CalendarEvent['attendees']) {
    return attendees.map(a => `${a.emailAddress.name} <${a.emailAddress.address}>`).join(', ');
}

function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }: {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const maxVisiblePages = 5;

    const getPageNumbers = () => {
        let pages = [];
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    if (totalPages <= 1) return null;

    return (
        <div className={styles.pagination}>
            <button
                className={styles.paginationButton}
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
            >
                Previous
            </button>
            
            {getPageNumbers().map(pageNum => (
                <button
                    key={pageNum}
                    className={`${styles.paginationButton} ${pageNum === currentPage ? styles.active : ''}`}
                    onClick={() => onPageChange(pageNum)}
                >
                    {pageNum}
                </button>
            ))}

            <button
                className={styles.paginationButton}
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                Next
            </button>
            
            <span className={styles.paginationInfo}>
                Page {currentPage} of {totalPages} ({totalItems} emails)
            </span>
        </div>
    );
}

export default function Home() {
    const [activeTab, setActiveTab] = useState<'emails' | 'calendar' | 'nextWeek' | 'knowledgeBase' | 'assistant'>('emails');
    const { 
        isAuthenticated, 
        userData, 
        emails,
        events,
        isLoading, 
        isLoadingEmails,
        isLoadingEvents,
        error, 
        signIn, 
        signOut,
        currentPage,
        currentEventsPage,
        totalEmails,
        totalEvents,
        itemsPerPage,
        changePage,
        changeEventsPage,
        syncToDatabase,
        isSyncing,
        nextWeekEvents,
        isLoadingNextWeekEvents,
        currentNextWeekEventsPage,
        totalNextWeekEvents,
        changeNextWeekEventsPage
    } = useAuth();

    return (
        <main className={styles.main}>
            <div className={styles.container}>
                {error && (
                    <div className={styles.error}>
                        {error}
                    </div>
                )}
                {!isAuthenticated ? (
                    <div className={styles.signInContainer}>
                        <h1 className={styles.title}>LLM Twin</h1>
                        <button 
                            onClick={signIn} 
                            className={styles.signInButton}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className={styles.loader}>Loading...</div>
                            ) : (
                                <Image
                                    src="/images/ms-symbollockup_signin_light.png"
                                    alt="Sign in with Microsoft"
                                    width={215}
                                    height={41}
                                    priority
                                />
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col w-full max-w-6xl mx-auto">
                        <div className={styles.profileContainer}>
                            {userData?.photoUrl && (
                                <div className={styles.photoContainer}>
                                    <img
                                        src={userData.photoUrl}
                                        alt="Profile"
                                        className={styles.profilePhoto}
                                    />
                                </div>
                            )}
                            <h2 className={styles.welcomeText}>
                                Welcome, {userData?.displayName}!
                            </h2>
                            <p className={styles.email}>{userData?.email}</p>
                            <div className={styles.profileActions}>
                                <button 
                                    onClick={signOut} 
                                    className={styles.signOutButton}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Signing out...' : 'Sign Out'}
                                </button>
                                <button
                                    onClick={syncToDatabase}
                                    className={styles.syncButton}
                                    disabled={isSyncing}
                                >
                                    {isSyncing ? (
                                        <>
                                            <div className={styles.loader}></div>
                                            Syncing...
                                        </>
                                    ) : 'DB Sync'}
                                </button>
                            </div>
                        </div>

                        <div className={styles.tabs}>
                            <button
                                className={`${styles.tabButton} ${activeTab === 'emails' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('emails')}
                            >
                                Outlook Emails
                            </button>
                            <button
                                className={`${styles.tabButton} ${activeTab === 'calendar' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('calendar')}
                            >
                                Outlook Calendar
                            </button>
                            <button
                                className={`${styles.tabButton} ${activeTab === 'nextWeek' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('nextWeek')}
                            >
                                Next Week Events
                            </button>
                            <button
                                className={`${styles.tabButton} ${activeTab === 'knowledgeBase' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('knowledgeBase')}
                            >
                                Knowledge Base
                            </button>
                            <button
                                className={`${styles.tabButton} ${activeTab === 'assistant' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('assistant')}
                            >
                                Assistant
                            </button>
                        </div>
                        {activeTab === 'emails' ? (
                            <div className={styles.emailsContainer}>
                                <h3 className={styles.emailsTitle}>Recent Emails</h3>
                                {isLoadingEmails ? (
                                    <div className={styles.emailsLoading}>
                                        <div className={styles.loader}></div>
                                        <p>Loading emails...</p>
                                    </div>
                                ) : emails.length > 0 ? (
                                    <>
                                        <div className={styles.emailsList}>
                                            {emails.map((email) => (
                                                <div 
                                                    key={email.id} 
                                                    className={`${styles.emailItem} ${!email.isRead ? styles.unread : ''}`}
                                                >
                                                    <div className={styles.emailHeader}>
                                                        <div className={styles.emailHeaderLeft}>
                                                            <div className={styles.emailFrom}>
                                                                <span className={styles.emailSender}>
                                                                    {email.from.emailAddress.name}
                                                                </span>
                                                                <span className={styles.emailAddress}>
                                                                    &lt;{email.from.emailAddress.address}&gt;
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className={styles.emailDate}>
                                                            {formatDate(email.receivedDateTime)}
                                                        </span>
                                                    </div>
                                                    <h4 className={styles.emailSubject}>{email.subject}</h4>
                                                    {email.toRecipients.length > 0 && (
                                                        <div className={styles.recipients}>
                                                            <span className={styles.recipientsLabel}>To:</span>
                                                            <span className={styles.recipientsList}>
                                                                {formatRecipients(email.toRecipients)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {email.ccRecipients.length > 0 && (
                                                        <div className={styles.recipients}>
                                                            <span className={styles.recipientsLabel}>CC:</span>
                                                            <span className={styles.recipientsList}>
                                                                {formatRecipients(email.ccRecipients)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <p className={styles.emailPreview}>{email.bodyPreview}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <Pagination
                                            currentPage={currentPage}
                                            totalItems={totalEmails}
                                            itemsPerPage={itemsPerPage}
                                            onPageChange={changePage}
                                        />
                                    </>
                                ) : (
                                    <p className={styles.noEmails}>No emails found</p>
                                )}
                            </div>
                        ) : activeTab === 'calendar' ? (
                            <div className={styles.calendarContainer}>
                                <h3 className={styles.calendarTitle}>Calendar Events</h3>
                                {isLoadingEvents ? (
                                    <div className={styles.eventsLoading}>
                                        <div className={styles.loader}></div>
                                        <p>Loading events...</p>
                                    </div>
                                ) : events.length > 0 ? (
                                    <>
                                        <div className={styles.eventsList}>
                                            {events.map((event) => (
                                                <div 
                                                    key={event.id} 
                                                    className={styles.eventItem}
                                                >
                                                    <h4 className={styles.eventSubject}>{event.subject}</h4>
                                                    <div className={styles.eventTime}>
                                                        <div>
                                                            <span className={styles.eventTimeLabel}>Start:</span>
                                                            {formatEventDate(event.start.dateTime, event.start.timeZone)}
                                                        </div>
                                                        <div>
                                                            <span className={styles.eventTimeLabel}>End:</span>
                                                            {formatEventDate(event.end.dateTime, event.end.timeZone)}
                                                        </div>
                                                    </div>
                                                    {event.attendees.length > 0 && (
                                                        <div className={styles.eventAttendees}>
                                                            <span className={styles.eventAttendeesLabel}>Attendees:</span>
                                                            <span className={styles.eventAttendeesList}>
                                                                {formatAttendees(event.attendees)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <p className={styles.eventPreview}>{event.bodyPreview}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <Pagination
                                            currentPage={currentEventsPage}
                                            totalItems={totalEvents}
                                            itemsPerPage={itemsPerPage}
                                            onPageChange={changeEventsPage}
                                        />
                                    </>
                                ) : (
                                    <p className={styles.noEvents}>No calendar events found</p>
                                )}
                            </div>
                        ) : activeTab === 'nextWeek' ? (
                            <div className={styles.calendarContainer}>
                                <h3 className={styles.calendarTitle}>Next Week's Events</h3>
                                {isLoadingNextWeekEvents ? (
                                    <div className={styles.emailsLoading}>
                                        <div className={styles.loader}></div>
                                        <p>Loading events...</p>
                                    </div>
                                ) : nextWeekEvents.length > 0 ? (
                                    <>
                                        <div className={styles.eventsList}>
                                            {nextWeekEvents.map((event) => (
                                                <div key={event.id} className={styles.eventItem}>
                                                    <h4 className={styles.eventSubject}>{event.subject}</h4>
                                                    <div className={styles.eventTime}>
                                                        <div>
                                                            <span className={styles.eventTimeLabel}>Start:</span>
                                                            {formatEventDate(event.start.dateTime, event.start.timeZone)}
                                                        </div>
                                                        <div>
                                                            <span className={styles.eventTimeLabel}>End:</span>
                                                            {formatEventDate(event.end.dateTime, event.end.timeZone)}
                                                        </div>
                                                    </div>
                                                    {event.attendees.length > 0 && (
                                                        <div className={styles.eventAttendees}>
                                                            <span className={styles.eventAttendeesLabel}>Attendees:</span>
                                                            <div className={styles.eventAttendeesList}>
                                                                {formatAttendees(event.attendees)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {event.bodyPreview && (
                                                        <p className={styles.eventPreview}>{event.bodyPreview}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <Pagination
                                            currentPage={currentNextWeekEventsPage}
                                            totalItems={totalNextWeekEvents}
                                            itemsPerPage={itemsPerPage}
                                            onPageChange={changeNextWeekEventsPage}
                                        />
                                    </>
                                ) : (
                                    <p>No events found for next week.</p>
                                )}
                            </div>
                        ) : activeTab === 'knowledgeBase' ? (
                            <div className="w-full">
                                <KnowledgeBase userId={userData?.email || ''} />
                            </div>
                        ) : activeTab === 'assistant' ? (
                            <div className="w-full">
                                <Assistant userId={userData?.email || ''} />
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </main>
    );
} 