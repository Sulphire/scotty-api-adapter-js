const crypto = require('crypto')
class ScottyAPI {

    constructor(url) {
        this.url = url;
    }

    getTransportOptions(from, to, date, lang="eng", raw=false) {
        return new Promise((resolve, reject) => {
            fetchRoute(from, to, date, this.url, lang, raw).then(data => {
                resolve(data)
            }).catch(err => {
                reject(err)
            })
        })
    }

    getLocations(query) {
        return new Promise((resolve, reject) => {
            fetchPossibleLocations(query, this.url).then(data => {
                resolve(data)
            }).catch(err => {
                reject(err)
            })
        })
    }

}

module.exports = {
    ScottyAPI,
    formatTime,
    calculateTimeDifference
}

function fetchRoute(from, to, date, url, lang, raw) {
    return new Promise(async (resolve, reject) => {
        const fromData = await fetchPossibleLocations(from, url)
        const toData = await fetchPossibleLocations(to, url)
        const bestFrom = fromData[0]
        const bestTo = toData[0]
        let customDate = dateTimeToCustomStrings(date)
        let obj = {
            "id": "z4iqmz8mgwk89w8x",
            "ver": "1.59",
            "lang": lang,
            "auth": {
                "type": "AID",
                "aid": "wf7mcf9bv3nv8g5f"
            },
            "client": {
                "id": "VAO",
                "type": "WEB",
                "name": "webapp",
                "l": "vs_vvv",
                "v": "20230522"
            },
            "formatted": false,
            "ext": "VAO.13",
            "svcReqL": [
                {
                    "meth": "TripSearch",
                    "req": {
                        "jnyFltrL": [
                            {
                                "type": "GROUP",
                                "mode": "INC",
                                "value": "OEV"
                            },
                            {
                                "type": "PROD",
                                "mode": "INC",
                                "value": 4087
                            }
                        ],
                        "getPolyline": true,
                        "getPasslist": true,
                        "arrLocL": [
                            {
                                "lid": bestTo.lid,
                                "name": bestTo.name
                            }
                        ],
                        "depLocL": [
                            {
                                "lid": bestFrom.lid,
                                "name": bestFrom.name
                            }
                        ],
                        "outFrwd": true,
                        "liveSearch": false,
                        "maxChg": "1000",
                        "minChgTime": "-1",
                        "getIV": true,
                        "economic": false,
                        "outDate": customDate[0],
                        "outTime": customDate[1],
                    },
                    "id": "1|68|"
                }
            ]
        }
        fetch("https://fahrplan.vmobil.at/bin/mgate.exe?rnd=1685660383360", {
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
                "Accept": "*/*",
                "Accept-Language": "en-GB,en;q=0.7,en-US;q=0.3",
                "Content-Type": "application/json",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                "Sec-GPC": "1"
            },
            "body": JSON.stringify(obj),
            "method": "POST",
        }).then(data => data.json()).then(async data => {
            let res = data.svcResL[0].res
            if (raw) {
                resolve(data)
                return
            }
            let common = res.common
            let outConL = res.outConL
            let options = []
            let nameMappings = common.prodL.map(prod => {
                return {
                    name: prod.name,
                    catOutL: prod.prodCtx.catOutL,
                    num: prod.prodCtx.num,
                    admin: prod.prodCtx.admin,
                    number: prod.number,
                }
            })
            for (let i = 0; i < outConL.length; i++) {
                let context = outConL[i]
                let mode_of_transport = common.prodL.find(item => outConL[i].secL.find(sec => {
                    let prodCtx = item.prodCtx
                    let journey = sec.jny
                    if (!prodCtx.line || !journey || !journey.jid) {
                        return false
                    }
                    return journey.ctxRecon.split("$")[5].trim() === prodCtx.line
                }))
                if (!mode_of_transport) {
                    continue
                }
                let timeline = []
                context.secL.forEach(seq => {
                    if (seq.type === 'WALK') {
                        timeline.push({
                            type: 'WALK',
                            dep: {
                                scheduled: parseTimeString(seq.dep.dTimeS),
                                real: parseTimeString(seq.dep.dTimeS),
                            },
                            arr: {
                                scheduled: parseTimeString(seq.arr.aTimeS),
                                real: parseTimeString(seq.arr.aTimeS),
                            },
                            mode: 'WALK'
                        })
                    } else if (seq.type === 'JNY') {
                        let seq_mode = nameMappings.filter(item => item.number === seq.jny.ctxRecon.split("$")[5].trim()).map(item => {
                            return {
                                type: item.catOutL,
                                num: item.num,
                                admin: item.admin,
                            }
                        })
                        seq_mode = seq_mode.length > 0 ? seq_mode[0] : undefined
                        const jnyObj = {
                            type: 'JNY',
                            dep: {
                                scheduled: parseTimeString(seq.dep.dTimeS),
                                real: parseTimeString(seq.dep.dTimeR),
                                stopName: seq.jny.ctxRecon.split("@")[1].substring(2),
                                platform: seq.dep.dPltfS ? seq.dep.dPltfS.txt : 'No platform',
                            },
                            arr: {
                                scheduled: parseTimeString(seq.arr.aTimeS),
                                real: parseTimeString(seq.arr.aTimeR),
                                stopName: seq.jny.ctxRecon.split("@")[5].substring(2),
                                platform: seq.arr.aPltfS ? seq.arr.aPltfS.txt : 'No platform',
                            },
                            id: seq.jny.ctxRecon.split("$")[5].trim(),
                            startAt: seq.jny.ctxRecon.split("@")[1].substring(2),
                            endAt: seq.jny.ctxRecon.split("@")[5].substring(2),
                            mode: seq_mode,
                        }
                        if (jnyObj.dep.platform === 'No platform') {
                            delete jnyObj.dep.platform
                        }
                        if (jnyObj.arr.platform === 'No platform') {
                            delete jnyObj.arr.platform
                        }
                        timeline.push(jnyObj)
                    } else if (seq.type === 'TRSF') {
                        timeline.push({
                            type: 'TRSF',
                            dep: {
                                scheduled: parseTimeString(seq.dep.dTimeS),
                                real: parseTimeString(seq.dep.dTimeR),
                            },
                            arr: {
                                scheduled: parseTimeString(seq.arr.aTimeS),
                                real: parseTimeString(seq.arr.aTimeR),
                            },
                            dur: seq.chg.durS
                        })
                    }
                })
                timeline = [...new Set(timeline)]
                const msgUint8 = new TextEncoder().encode(JSON.stringify(timeline))
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
                const hashArray = Array.from(new Uint8Array(hashBuffer))
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
                options.push({
                    start: timeline[0].dep,
                    end: timeline[timeline.length - 1].arr,
                    timeline: timeline,
                    hash: hashHex,
                })
            }
            options = options.reduce((accumulator, currentValue) => {
                if (!accumulator.find(item => item.hash === currentValue.hash)) {
                    accumulator.push(currentValue);
                }
                return accumulator;
            }, []);
            options = options.map(item => {
                return {
                    timeline: item.timeline,
                    start: item.start,
                    end: item.end,
                    timelineHash: item.hash,
                }
            })
            resolve(options)
        }).catch(err => {
            reject(err)
        })
    })
}

function fetchPossibleLocations(name, url) {
    return new Promise((resolve, reject) => {
        fetch(url, {
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
                "Accept": "*/*",
                "Accept-Language": "en-GB,en;q=0.7,en-US;q=0.3",
                "Content-Type": "application/json",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                "Sec-GPC": "1"
            },
            "body": "{\"id\":\"z4iqmz8mgwk89w8x\",\"ver\":\"1.59\",\"lang\":\"deu\",\"auth\":{\"type\":\"AID\",\"aid\":\"wf7mcf9bv3nv8g5f\"},\"client\":{\"id\":\"VAO\",\"type\":\"WEB\",\"name\":\"webapp\",\"l\":\"vs_vvv\",\"v\":\"20230522\"},\"formatted\":false,\"ext\":\"VAO.13\",\"svcReqL\":[{\"req\":{\"input\":{\"field\":\"S\",\"loc\":{\"type\":\"ALL\",\"dist\":1000,\"name\":\"" + name + "?\"},\"maxLoc\":7}},\"meth\":\"LocMatch\",\"id\":\"1|75|\"}]}",
            "method": "POST",
            "mode": "cors"
        }).then(data => data.json()).then(data => {
            if (data.svcResL.length === 0 || data.svcResL[0].res.match.locL.length === 0) {
                reject("No results")
                return
            }
            let res = data.svcResL[0].res
            let match = res.match
            let allStops = match.locL.map(loc => {
                return {
                    name: loc.name,
                    lid: loc.lid,
                }
            })
            allStops = [...new Set(allStops)]
            resolve(allStops)
        }).catch(err => {
            reject(err)
        });
    })
}

function parseTimeString(timeString) {
    if (!timeString || timeString.length !== 6) {
        return undefined
    }

    const hours = timeString.substring(0, 2);
    const minutes = timeString.substring(2, 4);
    const seconds = timeString.substring(4, 6);

    return {
        hours: parseInt(hours),
        minutes: parseInt(minutes),
        seconds: parseInt(seconds),
    };
}

function formatTime(timeObj) {
    if (!timeObj) {
        return timeObj
    }
    const hours = timeObj.hours.toString().padStart(2, '0');
    const minutes = timeObj.minutes.toString().padStart(2, '0');
    const seconds = timeObj.seconds.toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`
}

function calculateTimeDifference(time, time2) {
    let time1Seconds = time.hours * 3600 + time.minutes * 60 + time.seconds
    let time2Seconds = time2.hours * 3600 + time2.minutes * 60 + time2.seconds
    let difference = time1Seconds - time2Seconds
    let hours = Math.floor(difference / 3600)
    let minutes = Math.floor((difference - hours * 3600) / 60)
    let seconds = difference - hours * 3600 - minutes * 60
    return {hours, minutes, seconds}
}

function dateTimeToCustomStrings(date) {
    let year = date.getFullYear().toString()
    let month = (date.getMonth() + 1).toString().padStart(2, '0')
    let day = date.getDate().toString().padStart(2, '0')
    let hours = date.getHours().toString().padStart(2, '0')
    let minutes = date.getMinutes().toString().padStart(2, '0')
    let seconds = date.getSeconds().toString().padStart(2, '0')
    return [year + month + day, hours + minutes + seconds]
}