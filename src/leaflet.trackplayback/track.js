import L from 'leaflet'

import {
  isArray
} from './util'

/**
 * Track class
 */
export const Track = L.Class.extend({

  initialize: function (trackData = [], options) {
    L.setOptions(this, options)

    trackData.forEach(item => {
      // Add isOrigin field to identify whether it is an original sampling point, to distinguish from interpolation points
      item.isOrigin = true
    })
    this._trackPoints = trackData
    this._timeTick = {}
    this._update()
  },

  addTrackPoint: function (trackPoint) {
    if (isArray(trackPoint)) {
      for (let i = 0, len = trackPoint.length; i < len; i++) {
        this.addTrackPoint(trackPoint[i])
      }
    }
    this._addTrackPoint(trackPoint)
  },

  getTimes: function () {
    const times = []
    for (let i = 0, len = this._trackPoints.length; i < len; i++) {
      times.push(this._trackPoints[i].time)
    }
    return times
  },

  getStartTrackPoint: function () {
    return this._trackPoints[0]
  },

  getEndTrackPoint: function () {
    return this._trackPoints[this._trackPoints.length - 1]
  },

  getTrackPointByTime: function (time) {
    return this._trackPoints[this._timeTick[time]]
  },

  _getCalculateTrackPointByTime: function (time) {
    // First check if the last point is an original point
    let endpoint = this.getTrackPointByTime(time)
    let startPt = this.getStartTrackPoint()
    let endPt = this.getEndTrackPoint()
    const times = this.getTimes()
    if (time < startPt.time || time > endPt.time) return
    let left = 0
    let right = times.length - 1
    let n
    // Handle the case of only one point
    if (left === right) {
      return endpoint
    }
    // Use binary search to find the time interval containing the current time
    while (right - left !== 1) {
      n = parseInt((left + right) / 2)
      if (time > times[n]) left = n
      else right = n
    }

    const t0 = times[left]
    const t1 = times[right]
    const t = time
    const p0 = this.getTrackPointByTime(t0)
    const p1 = this.getTrackPointByTime(t1)
    startPt = L.point(p0.lng, p0.lat)
    endPt = L.point(p1.lng, p1.lat)
    const s = startPt.distanceTo(endPt)
    // Case where different times are at the same point
    if (s <= 0) {
      endpoint = p1
      return endpoint
    }
    // Assume the target moves at a constant speed in a straight line between two points
    // Calculate the velocity vector and the target position at time t
    const v = s / (t1 - t0)
    const sinx = (endPt.y - startPt.y) / s
    const cosx = (endPt.x - startPt.x) / s
    const step = v * (t - t0)
    const x = startPt.x + step * cosx
    const y = startPt.y + step * sinx
    // Calculate the direction of movement, 0-360 degrees
    const dir = endPt.x >= startPt.x ? (Math.PI * 0.5 - Math.asin(sinx)) * 180 / Math.PI : (Math.PI * 1.5 + Math.asin(sinx)) * 180 / Math.PI

    if (endpoint) {
      if (endpoint.dir === undefined) {
        endpoint.dir = dir
      }
    } else {
      endpoint = {
        lng: x,
        lat: y,
        dir: endPt.dir || dir,
        isOrigin: false,
        time,
        color: p0.color, // Copy color property from the starting point
        info: p0.info // Copy info property from the starting point to preserve other information
      }
    }
    return endpoint
  },

  // Get the track points before a specific time
  getTrackPointsBeforeTime: function (time) {
    const tpoints = []
    for (let i = 0, len = this._trackPoints.length; i < len; i++) {
      if (this._trackPoints[i].time < time) {
        tpoints.push(this._trackPoints[i])
      }
    }
    // Get the last point, derived from linear interpolation by time
    const endPt = this._getCalculateTrackPointByTime(time)
    if (endPt) {
      tpoints.push(endPt)
    }
    return tpoints
  },

  _addTrackPoint: function (trackPoint) {
    trackPoint.isOrigin = true
    this._trackPoints.push(trackPoint)
    this._update()
  },

  _update: function () {
    this._sortTrackPointsByTime()
    this._updatetimeTick()
  },

  // Sort track points by time using bubble sort
  _sortTrackPointsByTime: function () {
    const len = this._trackPoints.length
    for (let i = 0; i < len; i++) {
      for (let j = 0; j < len - 1 - i; j++) {
        if (this._trackPoints[j].time > this._trackPoints[j + 1].time) {
          const tmp = this._trackPoints[j + 1]
          this._trackPoints[j + 1] = this._trackPoints[j]
          this._trackPoints[j] = tmp
        }
      }
    }
  },

  // Create time index for track points to optimize search performance
  _updatetimeTick: function () {
    this._timeTick = {}
    for (let i = 0, len = this._trackPoints.length; i < len; i++) {
      this._timeTick[this._trackPoints[i].time] = i
    }
  }
})

export const track = function (trackData, options) {
  return new Track(trackData, options)
}
