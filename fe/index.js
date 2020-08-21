import { Calendar } from '@fullcalendar/core';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import * as services from './service';
import { createNewEvent, getEvents } from './crud';

window.services = services;

window.state = {
  calendars: [],
}

document.addEventListener('DOMContentLoaded', async function() {
  await services.initializeClientForUserView();

  const calendarEl = document.getElementById('app');

  const calendar = new Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      center: 'addEventButton',
    },
    plugins: [ dayGridPlugin, timeGridPlugin ],
    customButtons: {

      addEventButton: {
        text: 'add event',
        click: async function() {
          const start = prompt('Enter a start date as 2020-08-20T13:30:00 format');
          const end = prompt('Enter a start date as 2020-08-20T13:30:00 format');
          await createNewEvent(start, end);
          calendar.refetchEvents()
        }
      }
    },
    events: async ({ start, end, timeZone }, successCallback, failureCallback) => {
      let ets = await getEvents()
      console.log('ets: ', ets);

      successCallback([
        { title: 'my event', start: '2020-08-22', id: 1}
      ].concat(ets))
    }
  });


  calendar.render();
});
