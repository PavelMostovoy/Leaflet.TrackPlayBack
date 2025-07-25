import L from 'leaflet'

import { TrackLayer } from './tracklayer'

/**
 * Drawing class
 * Handles the drawing of track lines, track points, and target objects
 */
export const Draw = L.Class.extend({

  trackPointOptions: {
    isDraw: false,
    useCanvas: true,
    stroke: false,
    color: '#ef0300',
    fill: true,
    fillColor: '#ef0300',
    opacity: 0.3,
    radius: 4
  },
  trackLineOptions: {
    isDraw: false,
    stroke: true,
    color: '#1C54E2', // stroke color
    weight: 2,
    fill: false,
    fillColor: '#000',
    opacity: 0.3
  },
  targetOptions: {
    useImg: false,
    imgUrl: '../../static/images/ship.png',
    showText: false,
    width: 8,
    height: 18,
    color: '#00f', // stroke color
    fillColor: '#9FD12D'
  },
  toolTipOptions: {
    offset: [0, 0],
    direction: 'top',
    permanent: false
  },

  initialize: function (map, options) {
    L.extend(this.trackPointOptions, options.trackPointOptions)
    L.extend(this.trackLineOptions, options.trackLineOptions)
    L.extend(this.targetOptions, options.targetOptions)
    L.extend(this.toolTipOptions, options.toolTipOptions)

    this._showTrackPoint = this.trackPointOptions.isDraw
    this._showTrackLine = this.trackLineOptions.isDraw

    this._map = map
    this._map.on('mousemove', this._onmousemoveEvt, this)

    this._trackLayer = new TrackLayer().addTo(map)
    this._trackLayer.on('update', this._trackLayerUpdate, this)

    this._canvas = this._trackLayer.getContainer()
    this._ctx = this._canvas.getContext('2d')

    this._bufferTracks = []

    if (!this.trackPointOptions.useCanvas) {
      this._trackPointFeatureGroup = L.featureGroup([]).addTo(map)
    }

    // If target uses an image, load it first
    if (this.targetOptions.useImg) {
      const img = new Image()
      img.onload = () => {
        this._targetImg = img
      }
      img.onerror = () => {
        throw new Error('img load error!')
      }
      img.src = this.targetOptions.imgUrl
    }
  },

  update: function () {
    this._trackLayerUpdate()
  },

  drawTrack: function (trackpoints) {
    this._bufferTracks.push(trackpoints)
    this._drawTrack(trackpoints)
  },

  showTrackPoint: function () {
    this._showTrackPoint = true
    this.update()
  },

  hideTrackPoint: function () {
    this._showTrackPoint = false
    this.update()
  },

  showTrackLine: function () {
    this._showTrackLine = true
    this.update()
  },

  hideTrackLine: function () {
    this._showTrackLine = false
    this.update()
  },

  remove: function () {
    this._bufferTracks = []
    this._trackLayer.off('update', this._trackLayerUpdate, this)
    this._map.off('mousemove', this._onmousemoveEvt, this)
    if (this._map.hasLayer(this._trackLayer)) {
      this._map.removeLayer(this._trackLayer)
    }
    if (this._map.hasLayer(this._trackPointFeatureGroup)) {
      this._map.removeLayer(this._trackPointFeatureGroup)
    }
  },

  clear: function () {
    this._clearLayer()
    this._bufferTracks = []
  },

  _trackLayerUpdate: function () {
    if (this._bufferTracks.length) {
      this._clearLayer()
      this._bufferTracks.forEach(function (element) {
        this._drawTrack(element)
      }.bind(this))
    }
  },

  _onmousemoveEvt: function (e) {
    if (!this._showTrackPoint) {
      return
    }
    const point = e.layerPoint
    if (this._bufferTracks.length) {
      for (let i = 0, leni = this._bufferTracks.length; i < leni; i++) {
        for (let j = 0, len = this._bufferTracks[i].length; j < len; j++) {
          const tpoint = this._getLayerPoint(this._bufferTracks[i][j])
          if (point.distanceTo(tpoint) <= this.trackPointOptions.radius) {
            this._opentoolTip(this._bufferTracks[i][j])
            return
          }
        }
      }
    }
    if (this._map.hasLayer(this._tooltip)) {
      this._map.removeLayer(this._tooltip)
    }
    this._canvas.style.cursor = 'pointer'
  },

  _opentoolTip: function (trackpoint) {
    if (this._map.hasLayer(this._tooltip)) {
      this._map.removeLayer(this._tooltip)
    }
    this._canvas.style.cursor = 'default'
    const latlng = L.latLng(trackpoint.lat, trackpoint.lng)
    const tooltip = this._tooltip = L.tooltip(this.toolTipOptions)
    tooltip.setLatLng(latlng)
    tooltip.addTo(this._map)
    tooltip.setContent(this._getTooltipText(trackpoint))
  },

  _drawTrack: function (trackpoints) {
    // Draw track line
    if (this._showTrackLine) {
      this._drawTrackLine(trackpoints)
    }
    // Draw ship
    const targetPoint = trackpoints[trackpoints.length - 1]
    if (this.targetOptions.useImg && this._targetImg) {
      this._drawShipImage(targetPoint)
    } else {
      this._drawShipCanvas(targetPoint)
    }
    // Draw label information
    if (this.targetOptions.showText) {
      this._drawtxt(`Heading: ${parseInt(targetPoint.dir)}°`, targetPoint)
    }
    // Draw track points that have been passed
    if (this._showTrackPoint) {
      if (this.trackPointOptions.useCanvas) {
        this._drawTrackPointsCanvas(trackpoints)
      } else {
        this._drawTrackPointsSvg(trackpoints)
      }
    }
  },

  _drawTrackLine: function (trackpoints) {
    const options = this.trackLineOptions
    const tp0 = this._getLayerPoint(trackpoints[0])
    this._ctx.save()
    this._ctx.beginPath()
    // Draw track line
    this._ctx.moveTo(tp0.x, tp0.y)
    for (let i = 1, len = trackpoints.length; i < len; i++) {
      const tpi = this._getLayerPoint(trackpoints[i])
      this._ctx.lineTo(tpi.x, tpi.y)
    }
    this._ctx.globalAlpha = options.opacity
    if (options.stroke) {
      // Use direct color property if available, otherwise use default green or options color
      this._ctx.strokeStyle = trackpoints[0].color !== undefined ? trackpoints[0].color : ('#00FF00')
      this._ctx.lineWidth = options.weight
      this._ctx.stroke()
    }
    if (options.fill) {
      this._ctx.fillStyle = options.fillColor
      this._ctx.fill()
    }
    this._ctx.restore()
  },

  _drawTrackPointsCanvas: function (trackpoints) {
    const options = this.trackPointOptions
    this._ctx.save()

    // Use direct color property if available, otherwise use default green or options color
    const trackColor = trackpoints[0].color !== undefined ? trackpoints[0].color : ('#00FF00')
    const trackFillColor = trackpoints[0].color !== undefined ? trackpoints[0].color : ('#00FF00')

    for (let i = 0, len = trackpoints.length; i < len; i++) {
      if (trackpoints[i].isOrigin) {
        const latLng = L.latLng(trackpoints[i].lat, trackpoints[i].lng)
        const radius = options.radius
        const point = this._map.latLngToLayerPoint(latLng)
        this._ctx.beginPath()
        this._ctx.arc(point.x, point.y, radius, 0, Math.PI * 2, false)
        this._ctx.globalAlpha = options.opacity
        if (options.stroke) {
          this._ctx.strokeStyle = trackColor
          this._ctx.stroke()
        }
        if (options.fill) {
          this._ctx.fillStyle = trackFillColor
          this._ctx.fill()
        }
      }
    }
    this._ctx.restore()
  },

  _drawTrackPointsSvg: function (trackpoints) {
    for (let i = 0, len = trackpoints.length; i < len; i++) {
      if (trackpoints[i].isOrigin) {
        const latLng = L.latLng(trackpoints[i].lat, trackpoints[i].lng)
        const cricleMarker = L.circleMarker(latLng, this.trackPointOptions)
        cricleMarker.bindTooltip(this._getTooltipText(trackpoints[i]), this.toolTipOptions)
        this._trackPointFeatureGroup.addLayer(cricleMarker)
      }
    }
  },

  _drawtxt: function (text, trackpoint) {
    const point = this._getLayerPoint(trackpoint)
    this._ctx.save()
    this._ctx.font = '12px Verdana'
    this._ctx.fillStyle = '#000'
    this._ctx.textAlign = 'center'
    this._ctx.textBaseline = 'bottom'
    this._ctx.fillText(text, point.x, point.y - 12, 200)
    this._ctx.restore()
  },

  _drawShipCanvas: function (trackpoint) {
    const point = this._getLayerPoint(trackpoint)
    const rotate = trackpoint.dir || 0
    const w = this.targetOptions.width
    const h = this.targetOptions.height
    const dh = h / 3

    // Use direct color property if available, otherwise use default green or options color
    const shipColor = trackpoint.color !== undefined ? trackpoint.color : ('#00FF00')
    const shipFillColor = trackpoint.color !== undefined ? trackpoint.color : ('#00FF00')

    this._ctx.save()
    this._ctx.fillStyle = shipFillColor
    this._ctx.strokeStyle = shipColor
    this._ctx.translate(point.x, point.y)
    this._ctx.rotate((Math.PI / 180) * rotate)
    this._ctx.beginPath()
    this._ctx.moveTo(0, 0 - h / 2)
    this._ctx.lineTo(0 - w / 2, 0 - h / 2 + dh)
    this._ctx.lineTo(0 - w / 2, h / 2)
    this._ctx.lineTo(w / 2, h / 2)
    this._ctx.lineTo(w / 2, 0 - h / 2 + dh)
    this._ctx.closePath()
    this._ctx.fill()
    this._ctx.stroke()
    this._ctx.restore()
  },

  _drawShipImage: function (trackpoint) {
    const point = this._getLayerPoint(trackpoint)
    const dir = trackpoint.dir || 0
    const width = this.targetOptions.width
    const height = this.targetOptions.height
    const offset = {
      x: width / 2,
      y: height / 2
    }
    this._ctx.save()
    this._ctx.translate(point.x, point.y)
    this._ctx.rotate((Math.PI / 180) * dir)
    this._ctx.drawImage(this._targetImg, 0 - offset.x, 0 - offset.y, width, height)
    this._ctx.restore()
  },

  _getTooltipText: function (targetobj) {
    let content = []
    content.push('<table>')
    if (targetobj.info && targetobj.info.length) {
      for (let i = 0, len = targetobj.info.length; i < len; i++) {
        content.push('<tr>')
        content.push('<td>' + targetobj.info[i].key + '</td>')
        content.push('<td>' + targetobj.info[i].value + '</td>')
        content.push('</tr>')
      }
    }
    content.push('</table>')
    content = content.join('')
    return content
  },

  _clearLayer: function () {
    const bounds = this._trackLayer.getBounds()
    if (bounds) {
      const size = bounds.getSize()
      this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y)
    } else {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
    }
    if (this._map.hasLayer(this._trackPointFeatureGroup)) {
      this._trackPointFeatureGroup.clearLayers()
    }
  },

  _getLayerPoint (trackpoint) {
    return this._map.latLngToLayerPoint(L.latLng(trackpoint.lat, trackpoint.lng))
  }
})

export const draw = function (map, options) {
  return new Draw(map, options)
}
