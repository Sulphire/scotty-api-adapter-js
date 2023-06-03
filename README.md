# Scotty API Adapter
## Preface
This is a simple adapter for the Austrian OEBB Scotty (Hafas) Transport API. This is **unofficial** as there is no public documentation available for the original API.

Sulphire dose not guarantee that this adapter will work in the future as the API is not officially supported. As of right now, our adapter is working for most routes. The official API structure is very outdated, please see the disclaimer below for more details.

### Disclaimer
The original API is using time based on IP address geolocation and does not return the time in the timezone of departure. It is also not possible to change the timezone at the moment. The time the API returns is a simple "hhmmss" string, same goes for the date. There is no timezone info.

You can use standalone methods to format the time appropriately and calculate delays. Please see below.

## Currently supported apps
Other apps may be supported, but we have not tested them yet.
- VVV/vmobil.at (`https://fahrplan.vmobil.at/bin/mgate.exe`)

## Installation
```bash
npm install scotty-api-adapter
```

## Usage example
```javascript
const ScottyAdapter = require('scotty-api-adapter');
const scotty = new scottyAdapter.ScottyAPI("https://fahrplan.vmobil.at/bin/mgate.exe")

const startLocationQuery = await scotty.getLocations("Bregenz Bahnhof")
const endLocationQuery = await scotty.getLocations("Hohenems Bahnhof")
const startLocation = startLocationQuery[0].name; // get the first result
const endLocation = endLocationQuery[0].name;

const date = new Date(); // get journeys for current time (this might sometimes throw an error if there are no journeys in the near future)

const journeys = await scotty.getTransportOptions(startLocation, endLocation, date)
// journeys is an array of Journey objects, see below for more info
```

## Objects
**General Info**
- `real` time object might be undefined, please use scheduled time if real time is undefined
### Journey
A journey as returned by `getTransportOptions`. `start` and `end`'s scheduled and real are objects with { hours, minutes, seconds} as integers. `timeline` is an array of Timeline objects. `stopName` is the name of the stop. `platform` is the platform number, if available. `timelineHash` is a hash of the timeline array, this is only used for internal duplicate checking.
```json
{
  "timeline": Timeline[],
  "start": { scheduled, real, stopName, (platform) },
  "end": { scheduled, real, stopName, (platform) },
  "timelineHash": string,
}
```
### Timeline (array)
This is the order of a journey. `dep` and `arr` times are objects with { hours, minutes, seconds } as integers. `id` is the Bus number or the train number. `stopName` is the name of the stop. `platform` is the platform number, if available.

A journey where you start in a Bus and have to switch to train or a different Bus would look like this:
`JNY -> TNSF -> JNY`
```json
{
  "type": "JNY" | "WALK" | "TNSF",
  "dep": { scheduled, real, stopName, (platform) },
  "arr": { scheduled, real, stopName, (platform) },
  "id": string,
  "mode": TransportMode
}[]
```
### TransportMode
Transport mode as returned by the API. Type values are similar to "Bus" or "Train", depending on the source.
```json
{
  "type": string,
  "num": string,
  "admin": string,
}
```

## Methods
### ScottyAPI Class
#### getLocations(locationName)
Returns an array of locations matching the given name. The array is sorted by relevance, the first result is the most relevant one. The array is empty if no results were found.
```javascript
const locations = await scotty.getLocations("Bregenz Bahnhof")
```
#### getTransportOptions(startLocation, endLocation, date, lang, raw)
Returns an array of journeys. `startLocation` and `endLocation` are strings, `date` is a JavaScript Date object. Depending on the date and time, the API might not return any journeys. (Please read Disclaimer for time formats and zones) `lang` is the language of the response, default is "eng". `raw` is a boolean, if true, the raw response from the API is returned. Default is false.
```javascript
const journeys = await scotty.getTransportOptions("Bregenz Bahnhof", "Hohenems Bahnhof", new Date())
```

### Standalone functions
#### formatTime(time)
Formats a time object from the API to a readable format (hh:mm:ss).
```javascript
const time = { hours: 12, minutes: 30, seconds: 0 }
const formattedTime = scottyAdapter.formatTime(time) // 12:30:00
```
#### calculateTimeDifference(time1, time2)
Calculates the difference between two time objects from the API. Returns an object with { hours, minutes, seconds } as integers. Useful for calculating the delays or the duration of a journey.
```javascript
const time1 = { hours: 12, minutes: 30, seconds: 0 }
const time2 = { hours: 12, minutes: 45, seconds: 0 }
const timeDifference = scottyAdapter.calculateTimeDifference(time1, time2) // { hours: 0, minutes: 15, seconds: 0 }
```