"use client";

import { useState } from "react";
import { type Protocol } from "@/types/protocol";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Calendar, MapPin, Maximize2, Download } from "lucide-react";
import { useTranslations } from "next-intl";

interface ReportCardProps {
    protocol: Protocol;
    onViewFull: () => void;
    onDownload?: () => void;
}

export function ReportCard({ protocol, onViewFull, onDownload }: ReportCardProps) {
    const t = useTranslations("chat");

    const attendeesCount = protocol.attendees?.length || 0;
    const tasksCount = protocol.tasks?.length || 0;
    const agendaCount = protocol.agenda?.length || 0;

    return (
        <Card className="w-full max-w-md overflow-hidden bg-card border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="bg-muted/30 p-4 border-b border-border/50 flex items-start gap-4">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base leading-tight truncate" title={protocol.title}>
                        {protocol.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {protocol.date}
                        </span>
                        {protocol.location && (
                            <span className="flex items-center gap-1 truncate max-w-[120px]" title={protocol.location}>
                                <MapPin className="h-3 w-3" />
                                {protocol.location}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="flex flex-col items-center p-2 rounded-md bg-muted/20">
                    <span className="font-semibold text-lg">{agendaCount}</span>
                    <span className="text-xs text-muted-foreground">Topics</span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-md bg-muted/20">
                    <span className="font-semibold text-lg">{tasksCount}</span>
                    <span className="text-xs text-muted-foreground">Tasks</span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-md bg-muted/20">
                    <span className="font-semibold text-lg">{attendeesCount}</span>
                    <span className="text-xs text-muted-foreground">Attendees</span>
                </div>
            </div>

            <div className="p-3 bg-muted/10 border-t border-border/50 flex gap-2">
                <Button
                    variant="outline"
                    className="flex-1 gap-2 text-xs h-9"
                    onClick={onViewFull}
                >
                    <Maximize2 className="h-3.5 w-3.5" />
                    {t("viewReport") || "View Report"}
                </Button>
                {onDownload && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={onDownload}
                        title={t("downloadReport") || "Download Report"}
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </Card>
    );
}
