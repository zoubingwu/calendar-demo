import {createEvent, getParserManager} from 'calendar-js'

const getDefaultCalendarObject = (props = {}) => Object.assign({}, {
	// Id of the calendar
	id: '',
	// Visible display name
	displayName: '',
	// Color of the calendar
	color: uidToHexColor(''),
	// Whether or not the calendar is visible in the grid
	enabled: true,
	// Whether or not the calendar is loading events at the moment
	loading: false,
	// Whether this calendar supports VEvents
	supportsEvents: true,
	// Whether this calendar supports VJournals
	supportsJournals: false,
	// Whether this calendar supports VTodos
	supportsTasks: false,
	// The principal uri of the owner
	owner: '',
	// Timezone set for this calendar
	timezone: null,
	// List of shares
	shares: [],
	// Published url
	publishURL: null,
	// Internal CalDAV url of this calendar
	url: '',
	// Whether this calendar is read-only
	readOnly: false,
	// The order of this calendar in the calendar-list
	order: 0,
	// Whether or not the calendar is shared with me
	isSharedWithMe: false,
	// Whether or not the calendar can be shared by me
	canBeShared: false,
	// Whether or not the calendar can be published by me
	canBePublished: false,
	// Reference to cdav-lib object
	dav: false,
	// All calendar-objects from this calendar that have already been fetched
	calendarObjects: [],
	// Time-ranges that have already been fetched for this calendar
	fetchedTimeRanges: [],
}, props);

const getDefaultCalendarObjectObject = (props = {}) => Object.assign({}, {
	// Id of this calendar-object
	id: null,
	// Id of the associated calendar
	calendarId: null,
	// The cdav-library object storing the calendar-object
	dav: null,
	// The parsed calendar-js object
	calendarComponent: null,
	// The uid of the calendar-object
	uid: null,
	// The uri of the calendar-object
	uri: null,
	// The type of calendar-object
	objectType: null,
	// Whether or not the calendar-object is an event
	isEvent: false,
	// Whether or not the calendar-object is a journal
	isJournal: false,
	// Whether or not the calendar-object is a task
	isTodo: false,
	// Whether or not the calendar-object exists on the server
	existsOnServer: false,
	title: '',
	start: '',
	end: '',
}, props)

const mapDavCollectionToCalendar = (calendar, currentUserPrincipal) => {
	const id = btoa(calendar.url)
	const displayName = calendar.displayname || getCalendarUriFromUrl(calendar.url)

	// calendar.color can be set to anything on the server,
	// so make sure it's something that remotely looks like a color
	let color = detectColor(calendar.color)
	if (!color) {
		// As fallback if we don't know what color that is supposed to be
		color = uidToHexColor(displayName)
	}

	const supportsEvents = calendar.components?.includes('VEVENT')
	const supportsJournals = calendar.components?.includes('VJOURNAL')
	const supportsTasks = calendar.components?.includes('VTODO')
	const owner = calendar.owner
	const readOnly = !calendar.isWriteable()
	const canBeShared = calendar.isShareable()
	const canBePublished = calendar.isPublishable()
	const order = calendar.order || 0
	const url = calendar.url
	const publishURL = calendar.publishURL || null
	const timezone = calendar.timezone || null

	let isSharedWithMe = false
	if (!currentUserPrincipal) {
		// If the user is not authenticated, the calendar
		// will always be marked as shared with them
		isSharedWithMe = true
	} else {
		isSharedWithMe = (owner !== currentUserPrincipal.url)
	}

	let enabled
	if (!currentUserPrincipal) {
		// If the user is not authenticated,
		// always enable the calendar
		enabled = true
	} else if (typeof calendar.enabled === 'boolean') {
		// If calendar-enabled is set, we will just take that
		enabled = calendar.enabled
	} else {
		// If there is no calendar-enabled,
		// we will display the calendar by default if it's owned by the user
		// or hide it by default it it's just shared with them
		enabled = !isSharedWithMe
	}

	const shares = []
	if (!!currentUserPrincipal && Array.isArray(calendar.shares)) {
		for (const share of calendar.shares) {
			if (share.href === currentUserPrincipal.principalScheme) {
				continue
			}

			shares.push(mapDavShareeToCalendarShareObject(share))
		}
	}

	return getDefaultCalendarObject({
		id,
		displayName,
		color,
		order,
		url,
		enabled,
		supportsEvents,
		supportsJournals,
		supportsTasks,
		isSharedWithMe,
		owner,
		readOnly,
		publishURL,
		canBeShared,
		canBePublished,
		shares,
		timezone,
		dav: calendar,
	})
}

function detectColor(color) {
	if (/^(#)((?:[A-Fa-f0-9]{3}){1,2})$/.test(color)) { // #ff00ff and #f0f
		return color
	} else if (/^((?:[A-Fa-f0-9]{3}){1,2})$/.test(color)) { // ff00ff and f0f
		return '#' + color
	} else if (/^(#)((?:[A-Fa-f0-9]{8}))$/.test(color)) { // #ff00ffff and #f0ff
		return color.substr(0, 7)
	} else if (/^((?:[A-Fa-f0-9]{8}))$/.test(color)) { // ff00ffff and f0ff
		return '#' + color.substr(0, 6)
	}

	return false
}

function uidToHexColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const mapCalendarJsToCalendarObject = (calendarComponent, calendarId = null) => {
	const vObjectIterator = calendarComponent.getVObjectIterator()
	const firstVObject = vObjectIterator.next().value
	if (!firstVObject) {
		throw new Error('Calendar object without vobjects')
	}

	return getDefaultCalendarObjectObject({
		calendarId,
		calendarComponent,
		uid: firstVObject.uid,
		objectType: firstVObject.name,
		isEvent: firstVObject.name === 'VEVENT',
		isJournal: firstVObject.name === 'VJOURNAL',
		isTodo: firstVObject.name === 'VTODO',
	})
}

const mapCDavObjectToCalendarObject = (dav, calendarId) => {
	const parserManager = getParserManager()
	const parser = parserManager.getParserForFileType('text/calendar')

	// This should not be the case, but let's just be on the safe side
	if (typeof dav.data !== 'string' || dav.data.trim() === '') {
		throw new Error('Empty calendar object')
	}

	parser.parse(dav.data)

	const calendarComponentIterator = parser.getItemIterator()
	const calendarComponent = calendarComponentIterator.next().value
	if (!calendarComponent) {
		throw new Error('Empty calendar object')
	}

	const vObjectIterator = calendarComponent.getVObjectIterator()
	const firstVObject = vObjectIterator.next().value
	console.log('firstVObject: ', firstVObject);

	return getDefaultCalendarObjectObject({
		id: btoa(dav.url),
		calendarId,
		dav,
		calendarComponent,
		uid: firstVObject.uid,
		uri: dav.url,
		start: firstVObject.startDate.jsDate,
		end: firstVObject.endDate.jsDate,
		objectType: firstVObject.name,
		isEvent: firstVObject.name === 'VEVENT',
		isJournal: firstVObject.name === 'VJOURNAL',
		isTodo: firstVObject.name === 'VTODO',
		existsOnServer: true,
	})
}

export {
	getDefaultCalendarObject,
	mapDavCollectionToCalendar,
	detectColor,
	uidToHexColor,
	mapCalendarJsToCalendarObject,
	mapCDavObjectToCalendarObject,
}