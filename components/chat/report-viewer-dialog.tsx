"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type Protocol } from "@/types/protocol";
import { Download, Pin, X, Calendar, MapPin, Users, CheckSquare, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ReportViewerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    protocol: Protocol | null;
    onDownload: () => void;
}

export function ReportViewerDialog({
    open,
    onOpenChange,
    protocol,
    onDownload
}: ReportViewerDialogProps) {
    const t = useTranslations("chat");

    if (!protocol) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 bg-zinc-100/50 dark:bg-zinc-950/50 backdrop-blur-sm z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg md:w-full">
                {/* Header - Transparent/Glassy */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-lg">{t("reportPreview") || "Report Preview"}</h2>
                        <Badge variant="outline" className="font-normal">
                            {protocol.date}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={onDownload} className="gap-2">
                            <Download className="h-4 w-4" />
                            {t("downloadPDF") || "Download PDF"}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Content - Paper-like container */}
                <div className="flex-1 overflow-hidden relative">
                    <ScrollArea className="h-full w-full p-4 sm:p-8">
                        <div className="mx-auto max-w-[210mm] min-h-[297mm] bg-white text-zinc-900 shadow-2xl p-[20mm] rounded-sm selection:bg-blue-100 selection:text-blue-900">

                            {/* Document Header */}
                            <div className="mb-12 border-b-2 border-zinc-900 pb-6">
                                <div className="text-sm text-zinc-500 uppercase tracking-widest mb-2 font-semibold">
                                    {t("smartReport") || "Structured Report"}
                                </div>
                                <h1 className="text-3xl font-bold text-zinc-900 leading-tight mb-6">
                                    {protocol.title}
                                </h1>

                                <div className="flex flex-wrap gap-y-2 gap-x-8 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-zinc-400" />
                                        <span className="font-medium">Date:</span>
                                        <span>{protocol.date}</span>
                                    </div>
                                    {protocol.time && (
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-zinc-400" />
                                            <span className="font-medium">Time:</span>
                                            <span>{protocol.time}</span>
                                        </div>
                                    )}
                                    {protocol.location && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-zinc-400" />
                                            <span className="font-medium">Location:</span>
                                            <span>{protocol.location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Attendees Section */}
                            <div className="mb-10">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 mb-4 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {t("participants") || "Participants"}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                    <div>
                                        <div className="font-semibold mb-2 text-zinc-700">{t("present") || "Present"}:</div>
                                        <ul className="space-y-1">
                                            {protocol.attendees.map((person, idx) => (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <span className="block w-1.5 h-1.5 rounded-full bg-zinc-300 mt-1.5 shrink-0" />
                                                    <span>{person}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {(protocol.guests?.length || 0) > 0 && (
                                        <div>
                                            <div className="font-semibold mb-2 text-zinc-700">{t("guests") || "Guests"}:</div>
                                            <ul className="space-y-1 text-zinc-600">
                                                {protocol.guests?.map((person, idx) => (
                                                    <li key={idx} className="flex items-start gap-2">
                                                        <span className="block w-1.5 h-1.5 rounded-full bg-zinc-200 mt-1.5 shrink-0" />
                                                        <span>{person}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {(protocol.absent?.length || 0) > 0 && (
                                        <div className="mt-4 sm:mt-0">
                                            <div className="font-semibold mb-2 text-zinc-700">{t("absent") || "Absent"}:</div>
                                            <ul className="space-y-1 text-zinc-400 italic">
                                                {protocol.absent?.map((person, idx) => (
                                                    <li key={idx} className="flex items-start gap-2">
                                                        <span className="block w-1.5 h-1.5 rounded-full bg-zinc-100 mt-1.5 shrink-0" />
                                                        <span>{person}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Summary / Agenda */}
                            {protocol.agenda && protocol.agenda.length > 0 && (
                                <div className="mb-10">
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 mb-4 border-b border-zinc-100 pb-2">
                                        {t("agenda") || "Sections / Agenda"}
                                    </h3>
                                    <div className="space-y-6">
                                        {protocol.agenda.map((item, idx) => (
                                            <div key={idx} className="group">
                                                <div className="flex items-baseline gap-3 mb-1">
                                                    <span className="text-zinc-300 font-mono text-xs font-bold shrink-0">
                                                        {String(idx + 1).padStart(2, '0')}
                                                    </span>
                                                    <h4 className="font-semibold text-zinc-900">{item.title}</h4>
                                                    {item.duration && (
                                                        <span className="text-xs text-zinc-400 ml-auto font-mono bg-zinc-50 px-2 py-0.5 rounded">
                                                            {item.duration}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.description && (
                                                    <div className="pl-8 text-sm text-zinc-600 leading-relaxed text-justify">
                                                        {item.description}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* General Summary */}
                            {protocol.summary && (
                                <div className="mb-10">
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 mb-4 border-b border-zinc-100 pb-2">
                                        {t("summary") || "Summary"}
                                    </h3>
                                    <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                                        {protocol.summary}
                                    </div>
                                </div>
                            )}

                            {/* Tasks Table */}
                            {(protocol.tasks?.length || 0) > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 mb-4 flex items-center gap-2">
                                        <CheckSquare className="h-4 w-4" />
                                        {t("openTasks") || "Action Items / Recommendations"}
                                    </h3>
                                    <div className="border rounded-lg overflow-hidden border-zinc-200">
                                        <table className="w-full text-sm">
                                            <thead className="bg-zinc-50 text-left">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold text-zinc-600 w-12">#</th>
                                                    <th className="px-4 py-3 font-semibold text-zinc-600">{t("task") || "Task"}</th>
                                                    <th className="px-4 py-3 font-semibold text-zinc-600 w-32">{t("assignee") || "Assignee"}</th>
                                                    <th className="px-4 py-3 font-semibold text-zinc-600 w-28">{t("deadline") || "Due"}</th>
                                                    <th className="px-4 py-3 font-semibold text-zinc-600 w-24 text-center">{t("status") || "Status"}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100">
                                                {protocol.tasks.map((task, idx) => (
                                                    <tr key={task.id || idx} className="hover:bg-zinc-50/50">
                                                        <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{idx + 1}</td>
                                                        <td className="px-4 py-3 font-medium text-zinc-800">{task.title}</td>
                                                        <td className="px-4 py-3 text-zinc-600 truncate max-w-[120px]" title={task.assignee}>
                                                            {task.assignee}
                                                        </td>
                                                        <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{task.deadline}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border
                                ${task.status === 'done' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                    task.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                        'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                                                                {task.status === 'done' ? 'Done' : task.status === 'in_progress' ? 'WIP' : 'Open'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Next Meeting */}
                            {protocol.nextMeeting && (
                                <div className="mt-8 pt-8 border-t border-zinc-200 flex items-center justify-between text-sm text-zinc-500">
                                    <span className="font-medium">{t("nextMeeting") || "Next Steps"}:</span>
                                    <span>{protocol.nextMeeting}</span>
                                </div>
                            )}

                            <div className="mt-16 text-[10px] text-zinc-300 text-center uppercase tracking-widest">
                                Generated by Nexus AI
                            </div>

                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
