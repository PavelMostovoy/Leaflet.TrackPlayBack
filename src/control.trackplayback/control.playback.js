import L from 'leaflet'

/**
 * TrackPlayBackControl - A Leaflet control for track playback
 *
 * Options:
 * - position: Position of the control (default: 'topright')
 * - showOptions: Whether to show the options container (default: true)
 * - showInfo: Whether to show the info container (default: true)
 * - showSlider: Whether to show the slider container (default: true)
 */
export const TrackPlayBackControl = L.Control.extend({

  options: {
    position: 'topright',
    showOptions: true,
    showInfo: true,
    showSlider: true
  },

  initialize: function (trackplayback, options) {
    L.Control.prototype.initialize.call(this, options)
    this.trackPlayBack = trackplayback
    this.trackPlayBack.on('tick', this._tickCallback, this)
  },

  onAdd: function (map) {
    this._initContainer()
    return this._container
  },

  onRemove: function (map) {
    this.trackPlayBack.dispose()
    this.trackPlayBack.off('tick', this._tickCallback, this)
  },

  /**
   * Get time string from unix timestamp (unit: seconds)
   * @param  {[int]} time     [timestamp (accurate to seconds)]
   * @param  {[string]} accuracy [precision, day: d, hour: h, minute: m, second: s]
   * @return {[string]}          [yy:mm:dd hh:mm:ss]
   */
  getTimeStrFromUnix: function (time, accuracy = 's') {
    time = parseInt(time * 1000)
    const newDate = new Date(time)
    const year = newDate.getFullYear()
    const month = (newDate.getMonth() + 1) < 10 ? '0' + (newDate.getMonth() + 1) : newDate.getMonth() + 1
    const day = newDate.getDate() < 10 ? '0' + newDate.getDate() : newDate.getDate()
    const hours = newDate.getHours() < 10 ? '0' + newDate.getHours() : newDate.getHours()
    const minuts = newDate.getMinutes() < 10 ? '0' + newDate.getMinutes() : newDate.getMinutes()
    const seconds = newDate.getSeconds() < 10 ? '0' + newDate.getSeconds() : newDate.getSeconds()
    let ret
    if (accuracy === 'd') {
      ret = year + '-' + month + '-' + day
    } else if (accuracy === 'h') {
      ret = year + '-' + month + '-' + day + ' ' + hours
    } else if (accuracy === 'm') {
      ret = year + '-' + month + '-' + day + ' ' + hours + ':' + minuts
    } else {
      ret = year + '-' + month + '-' + day + ' ' + hours + ':' + minuts + ':' + seconds
    }
    return ret
  },

  _initContainer: function () {
    const className = 'leaflet-control-playback'
    this._container = L.DomUtil.create('div', className)
    L.DomEvent.disableClickPropagation(this._container)

    this._optionsContainer = this._createContainer('optionsContainer', this._container)
    this._infoContainer = this._createContainer('infoContainer', this._container)
    this._sliderContainer = this._createContainer('sliderContainer', this._container)

    this._pointCbx = this._createCheckbox('show trackPoint', 'show-trackpoint', this._optionsContainer, this._showTrackPoint)
    this._lineCbx = this._createCheckbox('show trackLine', 'show-trackLine', this._optionsContainer, this._showTrackLine)

    this._infoStartTime = this._createInfo('startTime: ', this.getTimeStrFromUnix(this.trackPlayBack.getStartTime()), 'info-start-time', this._infoContainer)
    this._infoEndTime = this._createInfo('endTime: ', this.getTimeStrFromUnix(this.trackPlayBack.getEndTime()), 'info-end-time', this._infoContainer)
    this._infoCurTime = this._createInfo('curTime: ', this.getTimeStrFromUnix(this.trackPlayBack.getCurTime()), 'info-cur-time', this._infoContainer)

    this._slider = this._createSlider('time-slider', this._sliderContainer, this._scrollchange)

    return this._container
  },

  _createContainer: function (className, container) {
    return L.DomUtil.create('div', className, container)
  },

  _createCheckbox: function (labelName, className, container, fn) {
    const divEle = L.DomUtil.create('div', className + ' trackplayback-checkbox', container)

    const inputEle = L.DomUtil.create('input', 'trackplayback-input', divEle)
    const inputId = `trackplayback-input-${L.Util.stamp(inputEle)}`
    inputEle.setAttribute('type', 'checkbox')
    inputEle.setAttribute('id', inputId)

    const labelEle = L.DomUtil.create('label', 'trackplayback-label', divEle)
    labelEle.setAttribute('for', inputId)
    labelEle.innerHTML = labelName

    L.DomEvent.on(inputEle, 'change', fn, this)

    return divEle
  },

  _createInfo: function (title, info, className, container) {
    const infoContainer = L.DomUtil.create('div', 'info-container', container)
    const infoTitle = L.DomUtil.create('span', 'info-title', infoContainer)
    infoTitle.innerHTML = title
    const infoEle = L.DomUtil.create('span', className, infoContainer)
    infoEle.innerHTML = info
    return infoEle
  },

  _createSlider: function (className, container, fn) {
    const sliderEle = L.DomUtil.create('input', className, container)
    sliderEle.setAttribute('type', 'range')
    sliderEle.setAttribute('min', this.trackPlayBack.getStartTime())
    sliderEle.setAttribute('max', this.trackPlayBack.getEndTime())
    sliderEle.setAttribute('value', this.trackPlayBack.getCurTime())

    L.DomEvent.on(sliderEle, 'click mousedown dbclick', L.DomEvent.stopPropagation)
      .on(sliderEle, 'click', L.DomEvent.preventDefault)
      .on(sliderEle, 'change', fn, this)
      .on(sliderEle, 'mousemove', fn, this)

    return sliderEle
  },

  _showTrackPoint (e) {
    if (e.target.checked) {
      this.trackPlayBack.showTrackPoint()
    } else {
      this.trackPlayBack.hideTrackPoint()
    }
  },

  _showTrackLine (e) {
    if (e.target.checked) {
      this.trackPlayBack.showTrackLine()
    } else {
      this.trackPlayBack.hideTrackLine()
    }
  },

  _scrollchange: function (e) {
    const val = Number(e.target.value)
    this.trackPlayBack.setCursor(val)
  },

  _tickCallback: function (e) {
    // Update time
    const time = this.getTimeStrFromUnix(e.time)
    this._infoCurTime.innerHTML = time
    // Update timeline
    this._slider.value = e.time
    // Stop playback when it reaches the end
    if (e.time >= this.trackPlayBack.getEndTime()) {
      this.trackPlayBack.stop()
    }
  }
})

export const trackplaybackcontrol = function (trackplayback, options) {
  return new TrackPlayBackControl(trackplayback, options)
}
