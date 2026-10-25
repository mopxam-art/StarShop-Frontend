'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CalendarEvent,
  CalendarDay,
  CalendarFilterStatus,
  CalendarViewMode,
} from './types';
import {
  getMonthMatrix,
  getWeekDays,
  filterCalendarEvents,
  calculateCalendarStats,
  formatDisplayDate,
} from './utils/calendarUtils';
import { generateMockEvents, DEFAULT_MOCK_EVENTS } from './constants/mockData';
import { CalendarHeader } from './components/CalendarHeader';
import { CalendarStatsCards } from './components/CalendarStatsCards';
import { CalendarFilters } from './components/CalendarFilters';
import { CalendarGrid } from './components/CalendarGrid';
import { CalendarWeekView } from './components/CalendarWeekView';
import { EventDetailsModal } from './components/EventDetailsModal';
import { Calendar as CalendarIcon, X } from 'lucide-react';

// Deterministic reference date for SSR and initial render consistency
const DETERMINISTIC_FALLBACK_DATE = new Date(2024, 2, 15);

interface BuyerCalendarProps {
  initialEvents?: CalendarEvent[];
  initialDate?: Date;
}

export function BuyerCalendar({
  initialEvents,
  initialDate,
}: BuyerCalendarProps) {
  // Deterministic state on initial render to prevent SSR hydration mismatch
  const [currentDate, setCurrentDate] = useState<Date>(
    () => initialDate || DETERMINISTIC_FALLBACK_DATE
  );
  const [dynamicEvents, setDynamicEvents] = useState<CalendarEvent[] | null>(
    null
  );

  // Hydrate user date and dynamic relative events after mount
  useEffect(() => {
    if (!initialDate) {
      setCurrentDate(new Date());
    }
    if (!initialEvents) {
      const dynamic = generateMockEvents(new Date());
      const map = new Map<string, CalendarEvent>();
      for (const ev of [...dynamic, ...DEFAULT_MOCK_EVENTS]) {
        map.set(ev.id, ev);
      }
      setDynamicEvents(Array.from(map.values()));
    }
  }, [initialDate, initialEvents]);

  // Base events combining relative dynamic generator and static orders
  const baseEvents = useMemo(() => {
    if (initialEvents) return initialEvents;
    if (dynamicEvents) return dynamicEvents;
    return DEFAULT_MOCK_EVENTS;
  }, [initialEvents, dynamicEvents]);

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [statusFilter, setStatusFilter] = useState<CalendarFilterStatus>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDateString, setSelectedDateString] = useState<string | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return filterCalendarEvents(baseEvents, statusFilter, searchQuery);
  }, [baseEvents, statusFilter, searchQuery]);

  // Overall stats based on base events
  const stats = useMemo(() => {
    return calculateCalendarStats(baseEvents);
  }, [baseEvents]);

  // Month navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      );
    } else {
      setCurrentDate(
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - 7
        )
      );
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      );
    } else {
      setCurrentDate(
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 7
        )
      );
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateString(null);
  };

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  }, []);

  const handleSelectDay = useCallback((day: CalendarDay) => {
    setSelectedDateString(prev =>
      prev === day.dateString ? null : day.dateString
    );
  }, []);

  // Compute matrix of days based on active view mode and live filter state
  const days: CalendarDay[] = useMemo(() => {
    if (viewMode === 'month') {
      return getMonthMatrix(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        filteredEvents,
        selectedDateString || undefined
      );
    } else {
      return getWeekDays(
        currentDate,
        filteredEvents,
        selectedDateString || undefined
      );
    }
  }, [currentDate, viewMode, filteredEvents, selectedDateString]);

  // Derive active selected day from days to reflect live filter counts and allow event selection
  const activeSelectedDay = useMemo(() => {
    if (!selectedDateString) return null;
    return days.find(d => d.dateString === selectedDateString) || null;
  }, [days, selectedDateString]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewModeChange={setViewMode}
      />

      {/* Metrics / Stats Cards */}
      <CalendarStatsCards stats={stats} />

      {/* Search & Filter Controls */}
      <CalendarFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Selected Day Banner if active */}
      {activeSelectedDay && (
        <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-4 text-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-purple-400" />
              <span className="text-white font-medium">
                Selected Day: {formatDisplayDate(activeSelectedDay.dateString)}
              </span>
              <span className="text-gray-400">
                ({activeSelectedDay.events.length} event(s))
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDateString(null)}
              className="flex items-center gap-1 text-xs text-purple-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear selection</span>
            </button>
          </div>
          {activeSelectedDay.events.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-purple-500/20">
              {activeSelectedDay.events.map(event => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleSelectEvent(event)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all hover:scale-105 ${event.statusColor} ${event.textColor}`}
                >
                  <span className="font-semibold">{event.orderId}</span> -{' '}
                  {event.product}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Calendar View (Month or Week) */}
      {viewMode === 'month' ? (
        <CalendarGrid
          days={days}
          onSelectEvent={handleSelectEvent}
          onSelectDay={handleSelectDay}
        />
      ) : (
        <CalendarWeekView
          days={days}
          onSelectEvent={handleSelectEvent}
          onSelectDay={handleSelectDay}
        />
      )}

      {/* Event Details Dialog Modal */}
      <EventDetailsModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}

export default BuyerCalendar;
