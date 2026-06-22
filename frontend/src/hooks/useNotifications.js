import { useEffect, useState } from 'react';
import { notification } from 'antd';
import socket from '../socket';
import dayjs from 'dayjs';

export function useNotifications() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const handleFlight = (data) => {
      if (data.status === 'delayed') {
        notification.warning({
          key:         `delay-${data.id}`,
          message:     `Flight Delayed: ${data.flight_number}`,
          description: data.estimated_departure
            ? `New ETD: ${dayjs(data.estimated_departure).format('HH:mm')}`
            : 'Delay announced — check flight board for updates',
          placement: 'topRight',
          duration:   8,
        });
        setUnread(n => n + 1);
      }
    };

    const handleIncident = (data) => {
      if (data?.severity === 'critical') {
        notification.error({
          key:         `incident-${data.id}`,
          message:     'Critical Incident',
          description: `${data.airport_iata ?? ''} — ${data.title}`,
          placement:   'topRight',
          duration:    12,
        });
        setUnread(n => n + 1);
      }
    };

    socket.on('flight:updated',   handleFlight);
    socket.on('incident:created', handleIncident);

    return () => {
      socket.off('flight:updated',   handleFlight);
      socket.off('incident:created', handleIncident);
    };
  }, []);

  return { unread, clearUnread: () => setUnread(0) };
}
