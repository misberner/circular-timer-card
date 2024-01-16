import { html, svg, css, LitElement } from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";
import { repeat } from "https://cdn.jsdelivr.net/gh/lit/dist@3.0.0/all/lit-all.min.js";
import * as d3 from "https://cdn.skypack.dev/d3@7";

class CircularTimerCard extends LitElement {

  constructor() {
    super();

    // Defaults
    this._bins = 36;
    this._padAngle = 1;
    this._cornerRadius = 4;
    this._defaultTimerFill = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
    this._gradientColors = [this._defaultTimerFill, this._defaultTimerFill];
    this._defaultTimerEmptyFill = "#fdfdfd00";
    this._secondaryInfoSize = "";
    this._layout = "circle";
    
    this._name = "use_entity_friendly_name";
    this._icon = "use_entity_icon";
    this._primaryInfo = "name";
    this._secondaryInfo = "timer";
    this._direction = "countdown";
    this._tapAction = "toggle";
    this._holdAction = "more_info";
    this._doubleTapAction = "cancel";

    this._colorState = false;
    this._stateColor = getComputedStyle(document.documentElement).getPropertyValue("--primary-text-color");

    // To update card every half second
    this._timeUpdater = 1;
    setInterval(() => {this._timeUpdater++;}, 500);

    // Event listener bindings (https://developers.home-assistant.io/blog/2023/07/07/action-event-custom-cards/)

    this.addEventListener("click", this._tap);

    this._mouseIsDown = false;
    this._mouseIsDownTriggered = false;
    this._doubleClickTriggered = false;
    this.addEventListener("mousedown", this._mousedown);
    this.addEventListener("touchstart", this._mousedown);
    this.addEventListener("mouseup", this._mouseup);
    this.addEventListener("touchend", this._mouseup);

    this.addEventListener("dblclick", this._double_tap);

    ////
  }
  
  static get properties() {
    return {
      _config: {},
      _timeUpdater: {}
    };
  }

  setConfig(config) {

    if (!config.entity) {
      throw new Error("You need to provide entity!");
    }

    var domain = config.entity.split(".")[0];

    // Define the action config
    this._actionConfig = {
      entity: config.entity,
      hold_action: {
        action: "more-info",
        start_listening: true,
      }
    };

    if (domain !== "timer") {
      this._startTime = config.start_time || {};
      this._endTime = config.end_time || {};
    } else {
      if (config.start_time || config.end_time) {
        throw new Error("start_time and end_time must not be specified for timer entities");
      }
    }

    if (config.layout) {
      if (config.layout === "minimal") {
        this._layout = "minimal";
      }
    }

    if (config.bins) {
      this._bins = config.bins;
    }
    this._seqmentSize = 360 / this._bins;

    if (config.pad_angle) {
      this._padAngle = config.pad_angle;
    }

    if (config.corner_radius) {
      this._cornerRadius = config.corner_radius;
    }

    if (config.color) {
      if (config.color.length === 1) {
        this._gradientColors = [config.color[0], config.color[0]];
      } else {
        this._gradientColors = config.color;
      }
    }

    if (config.color_state) {
      this._colorState = config.color_state;
    }

    if (config.empty_bar_color) {
      this._defaultTimerEmptyFill = config.empty_bar_color;
    }

    if (config.secondary_info_size) {
      this._secondaryInfoSize = config.secondary_info_size;
    } else {
      if (config.layout === "minimal") {
        this._secondaryInfoSize = "80%";
      } else {
        this._secondaryInfoSize = "50%";
      }
    }

    if (config.name) {
      this._name = config.name;
    }

    if (config.icon) {
      this._icon = config.icon;
    }

    if (config.primary_info) {
      this._primaryInfo = config.primary_info;
    }

    if (config.secondary_info) {
      this._secondaryInfo = config.secondary_info;
    }
    
    if (config.direction) {
      this._direction = config.direction;
    }
    
    if (config.tap_action) {
      this._tapAction = config.tap_action;
    }

    if (config.hold_action) {
      this._holdAction = config.hold_action;
    }

    if (config.double_tap_action) {
      this._doubleTapAction = config.double_tap_action;
    }
    
    this._colorScale = d3.scaleSequential(d3.interpolateRgbBasis(this._gradientColors));
    this._arc = d3.arc()
      .innerRadius(30)
      .outerRadius(48)
      .startAngle( (d)  => { return this._toRadians(d.start); })
      .endAngle( (d)  => { return this._toRadians(d.end); })
      .cornerRadius(this._cornerRadius)
      .padAngle(this._toRadians(this._padAngle));

    this._arcData = this._generateArcData();
    this._barData = this._generateBarData();

    this._config = config;
  }

  render() {

    if (!this.hass || !this._config) {
      return html``;
    }

    const stateObj = this.hass.states[this._config.entity];
    if (!stateObj) {
      return html` <ha-card>Unknown entity: ${this._config.entity}</ha-card> `;
    }

    if (this._name == "use_entity_friendly_name") {
      this._name = stateObj.attributes.friendly_name;
    }

    var icon;
    var icon_style;
    if (this._icon == "use_entity_icon") {
      icon = stateObj.attributes.icon;
    } else if (this._icon == "none") {
      icon = "";
      icon_style = "display:none;";
    } else {
      icon = this._icon;
    }

    const { rem_sec, d_sec } = this._parseState(stateObj);
    var proc = rem_sec / d_sec;

    var limitBin = Math.floor(this._bins * proc);
    var colorData = this._generateArcColorData(limitBin);
    var textColor = this._getTextColor(proc);
    
    var display_rem_sec = this._getTimeString(rem_sec);
    
    var primary_info;
    if (this._primaryInfo == "none") {
      primary_info = '';
    } else if (this._primaryInfo == "timer") {
      primary_info = display_rem_sec;
    } else {
      primary_info = this._name;
    }
      
    var secondary_info;
    if (this._secondaryInfo == "none") {
      secondary_info = '';
    } else if (this._secondaryInfo == "name") {
      secondary_info = this._name;
    } else {
      secondary_info = display_rem_sec;
    }

    if (this._layout === "minimal") {

      return html`
      <ha-card>
        <div class="header">
          <div class="icon" style="${icon_style}">
            <ha-icon icon="${icon}" style="${this._colorState ? `color: ${textColor};"` : `""`};"></ha-icon>
          </div> 
          <div class="info">
            <span class="primary">${primary_info}</span>
            <span class="secondary" style="font-size:${this._secondaryInfoSize};">${secondary_info}</span>
          </div>
        </div>
        <svg viewBox="0 0 100 10.2">
          <g transform="translate(0,0)">
            ${repeat(
              this._barData,
              (d) => d.id,
              (d, index) => svg`<rect x=${d.x} y=${d.y} width=${d.width} height=${d.height} rx="1" fill=${colorData[index]} />`
            )}
          </g>
        </svg>
      </ha-card>
    `;

    } else {

      return html`
      <ha-card>
        <svg viewBox="0 0 100 100">
          <g transform="translate(50,50)">
            ${repeat(
              this._arcData,
              (d) => d.id,
              (d, index) => svg`<path class="arc" d=${d.arc} fill=${colorData[index]} />`
            )}
          </g>
          <g transform="translate(50,50)">
            <text id="countdown" text-anchor="middle" dominant-baseline="central" fill=${textColor}>${secondary_info}</text>
          </g>
          <g transform="translate(50,62)">
            <text id="timer-name" text-anchor="middle" dominant-baseline="central" fill="var(--secondary-text-color)" style="font-size:${this._secondaryInfoSize};">${primary_info}</text>
          </g>
        </svg>
      </ha-card>
    `;

    }
  }

  _parseState(stateObj) {
    if (this._config.entity.startsWith("timer.")) {
      return this._parseStateTimer(stateObj);
    }

    const startTS = this._parseValue(stateObj, this._startTime);
    const endTS = this._parseValue(stateObj, this._endTime);
    const nowTS = new Date().valueOf();

    const d_sec = endTS - startTS;
    const rem_sec = Math.max(endTS - nowTS, 0);

    return { d_sec, rem_sec };
  }

  _parseValue(stateObj, valConfig) {
    const val = valConfig.attribute ? stateObj.attributes[valConfig.attribute] : stateObj.state;

    const numVal = parseFloat(val);
    if (!isNaN(val) && !isNaN(numVal)) {
      return numVal;
    }

    const dateVal = new Date(val);
    if (!isNaN(dateVal)) {
      return dateVal.valueOf();
    }

    throw new Error("unparseable timestamp");
  }

  _parseStateTimer(stateObj) {
    const a = stateObj.attributes.duration.split(':');
    const d_sec = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
    let rem_sec;
    if (stateObj.state == "active") {
      if (this._direction == "countup") {
        rem_sec = d_sec - ((Date.parse(stateObj.attributes.finishes_at) - new Date()) / 1000);
      } else {
        rem_sec = ((Date.parse(stateObj.attributes.finishes_at) - new Date()) / 1000);
      }
    } else {
      if (stateObj.state == "paused") {
        var a1 = stateObj.attributes.remaining.split(':');
        if (this._direction == "countup") {
          rem_sec = d_sec - ((+a1[0]) * 60 * 60 + (+a1[1]) * 60 + (+a1[2]));
        } else {
          rem_sec = (+a1[0]) * 60 * 60 + (+a1[1]) * 60 + (+a1[2]);
        }
      } else {
        rem_sec = d_sec;
      }
    }

    return { rem_sec, d_sec };
  }

  _generateArcData() {
    var data = [];
    for (var i = 0; i < this._bins; i++){
      data.push({arc: this._arc({start: i*this._seqmentSize, end: (i+1) * this._seqmentSize}), id: i});
    }
    return data;
  }

  _generateBarData() {

    var pad = 1;
    
    var width = ((100 + pad ) / this._bins) - pad;
    var height = 10;

    var data = [];
    for (var i = 0; i < this._bins; i++){

      var x = i * (width + pad);
      var y = 0;

      data.push({x: x, y: y, width: width, height: height, id: i});
    }
    return data;
  }

  _generateArcColorData(limitBin) {
    var data = [];
    for (var i = 0; i < this._bins; i++){
      var color;
      if (i < limitBin) {
        color = this._colorScale( i / (this._bins - 1) );
      } else {
        color = this._defaultTimerEmptyFill;
      }
  
      data.push(color);
    }
    return data;
  }

  _getTextColor(proc) {
    if (this._colorState) {
      return this._colorScale(proc);
    } else {
      return this._stateColor;
    }
  }

  _toRadians(deg) {
    return deg * (Math.PI / 180);
  }

  _getTimeString(s) {

    var h = Math.floor(s / 3600);
    var m = Math.floor(s % 3600 / 60);
    var s = Math.floor(s % 3600 % 60);

    var hours = h.toString().padStart(2, '0');
    var minutes = m.toString().padStart(2, '0');
    var seconds = s.toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`
  }

  _toggle_func() {
    if (!this._config.entity.startsWith("timer.")) {
      return;
    }
    const stateObj = this.hass.states[this._config.entity];
    const service = stateObj.state === "active" ? "pause" : "start";  
    this.hass.callService("timer", service, { entity_id: this._config.entity });
  }

  _cancel_func() {
    if (!this._config.entity.startsWith("timer.")) {
      return;
    }
    const stateObj = this.hass.states[this._config.entity];
    this.hass.callService("timer", "cancel", { entity_id: this._config.entity });
  }

  _moreInfo_func() {
    var event = new Event("hass-action", {
      bubbles: true,
      composed: true,
    });
    event.detail = {
      config: this._actionConfig,
      action: "hold",
    };
    this.dispatchEvent(event);
  }
  
  _tap(e) {
    if(this._mouseIsDownTriggered == false) {
      setTimeout(() => {
        if (this._doubleClickTriggered == false) {
          if (this._tapAction == "toggle") {
            this._toggle_func();
          } else if (this._tapAction == "more_info") {
            this._moreInfo_func();
          } else if (this._tapAction == "cancel") {
            this._cancel_func();
          }
        }
      }, 200);
    }
  }

  _double_tap(e) {
    this._doubleClickTriggered = true;
    if (this._doubleTapAction == "toggle") {
      this._toggle_func();
    } else if (this._doubleTapAction == "more_info") {
      this._moreInfo_func();
    } else if (this._doubleTapAction == "cancel") {
      this._cancel_func();
    }
    setTimeout(() => {
      this._doubleClickTriggered = false;
    }, 500);
  }

  _mousedown(e) {
    this._mouseIsDown = true;
    setTimeout(() => {
      if(this._mouseIsDown) {
        this._mouseIsDownTriggered = true;
        if (this._holdAction == "toggle") {
          this._toggle_func();
        } else if (this._holdAction == "more_info") {
          this._moreInfo_func();
        } else if (this._holdAction == "cancel") {
          this._cancel_func();
        }
      }
    }, 1000);    
  }

  _mouseup(e) {
    setTimeout(() => {
      this._mouseIsDown = false;
      this._mouseIsDownTriggered = false;
     }, 100);
  }

  static get styles() {

    return css`

      ha-card {
        padding: 10px;
      }

      path:hover {
        opacity: 0.85;
      }
      rect:hover {
        opacity: 0.85;
      }
      #countdown  {
        font-weight: 600;
        font-size: 85%;
      }
      #timer-name {
        font-weight: 600;

        text-transform: capitalize;
      }
      #compact-countdown {
        font-weight: 600;
        font-size: 35%;
      }

      .header {
        display: flex;
        padding: 0px;
        justify-content: flex-start;
        cursor: pointer;

        margin-bottom: 10px;
      }

      ha-icon {
        color: rgba(189, 189, 189, 1);
      }

      .info {

        display: flex;
        flex-direction: column;
        justify-content: center;

        font-weight: 700;

        min-width: 0;
      }

      .info span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .primary {
        color: var(--primary-text-color);

        font-size: 14px;
      }

      .secondary {
        color: var(--secondary-text-color);
        text-transform: capitalize;
      }

      .icon {

        width: 42px;
        height: 42px;

        flex-shrink: 0;

        display: flex;
        align-items: center;
        justify-content: center;

        margin-right: 10px;


        background: rgba(34, 34, 34, 0.05);
        border-radius: 500px;

        

      }
    `;
  }
}

customElements.define("circular-timer-card", CircularTimerCard);

console.info(
  `%c circular-timer-card | Version 1.1 `,
  "color: white; font-weight: bold; background: #FF4F00",
);
