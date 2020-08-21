import DateTimeValue from 'calendar-js/src/values/dateTimeValue'
import CalendarComponent from 'calendar-js/src/components/calendarComponent.js'
import { getTimezoneManager } from 'calendar-js'
import Timezone from 'calendar-js/src/timezones/timezone.js'
import {createEvent, getParserManager} from 'calendar-js'
import {mapDavCollectionToCalendar, uidToHexColor, getDefaultCalendarObject, mapCDavObjectToCalendarObject} from './utils';
import * as services from './service';


export const timezoneManager = getTimezoneManager();

export async function appendCalendar(
  displayName,
  color = uidToHexColor(),
  order = 1,
  components = ['VEVENT'],
  timezone = 'UTC'
) {

  const response = await services.createCalendar(displayName, color, components, order, timezone)
  const calendar = mapDavCollectionToCalendar(response);
  return calendar;
};

export async function createNewEvent(start = Date.now(), end = Date.now() + 3600000, isAllDay=false) {
  const calendars = await services.findAllCalendars();
  console.log('calendars: ', calendars);

  const timezone = timezoneManager.getTimezoneForId('UTC')

  const startDate = new Date(start)
  const endDate = new Date(end)

  const startDateTime = DateTimeValue
    .fromJSDate(startDate, true)
    .getInTimezone(timezone)
  const endDateTime = DateTimeValue
    .fromJSDate(endDate, true)
    .getInTimezone(timezone)

  if (isAllDay) {
    startDateTime.isDate = true
    endDateTime.isDate = true
  }
  const calendarObject = createEvent(startDateTime, endDateTime);
  console.log('calendarObject: ', calendarObject);
  getDefaultCalendarObject(mapDavCollectionToCalendar(calendars[0])).dav.createVObject(calendarObject.toICS())
}

export async function getEvents() {
  const calendars = await services.findAllCalendars();
  const calendarObject  = calendars.map((c) => getDefaultCalendarObject(mapDavCollectionToCalendar(c)));

  console.log('calendarObject: ', calendarObject);

  const response = await Promise.all(calendarObject.map(c => c.dav.findByType('VEVENT')))
;
  console.log('response: ', response.flat());

  return response.flat().map(i => mapCDavObjectToCalendarObject(i, '111'));
}