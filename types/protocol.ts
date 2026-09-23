export interface ProtocolTask {
    id: string;
    title: string;
    assignee: string;
    deadline: string;
    status: 'open' | 'done' | 'in_progress';
}

export interface ProtocolAgendaItem {
    title: string;
    description?: string;
    duration?: string;
}

export interface Protocol {
    title: string;
    date: string;
    time?: string;
    location: string;
    attendees: string[];
    guests?: string[];
    absent?: string[];
    agenda: ProtocolAgendaItem[];
    summary: string;
    tasks: ProtocolTask[];
    nextMeeting?: string;
}
