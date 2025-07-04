import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import MediaControlService from '../services/media-control-service';
import Store from '../model/store';
import { CardConfig } from '../types';
import { MediaPlayer } from '../model/media-player';
import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';

class Volume extends LitElement {
  @property({ attribute: false }) store!: Store;
  private config!: CardConfig;
  private mediaControlService!: MediaControlService;
  @property({ attribute: false }) player!: MediaPlayer;
  @property({ type: Boolean }) updateMembers = true;
  @property() volumeClicked?: () => void;
  @property() slim: boolean = false;
  @property({ type: String }) orientation?: string;

  render() {
    console.log('sonos-volume orientation:', this.orientation);
    this.config = this.store.config;
    this.mediaControlService = this.store.mediaControlService;

    const volume = this.player.getVolume();
    const max = this.getMax(volume);
    const disabled = this.player.ignoreVolume;

    // Use the custom pure CSS/HTML vertical slider for all usages
    return html`
      <sonos-simple-vertical-slider
        .value=${volume}
        .max=${max}
        .disabled=${disabled}
        .tickCount=${12}
        @value-changed=${this.volumeChanged}
      ></sonos-simple-vertical-slider>
    `;
  }

  private getMax(volume: number) {
    const dynamicThreshold = Math.max(0, Math.min(this.config.dynamicVolumeSliderThreshold ?? 20, 100));
    const dynamicMax = Math.max(0, Math.min(this.config.dynamicVolumeSliderMax ?? 30, 100));
    return volume < dynamicThreshold && this.config.dynamicVolumeSlider ? dynamicMax : 100;
  }

  private async volumeChanged(e: Event) {
    const newVolume = numberFromEvent(e);
    return await this.mediaControlService.volumeSet(this.player, newVolume, this.updateMembers);
  }

  private async mute() {
    return await this.mediaControlService.toggleMute(this.player, this.updateMembers);
  }

  static get styles() {
    return css`
      ha-control-slider {
        --control-slider-color: var(--accent-color);
      }

      ha-control-slider.over-threshold {
        --control-slider-color: var(--primary-text-color);
      }

      ha-control-slider[disabled] {
        --control-slider-color: var(--disabled-text-color);
      }

      *[slim] * {
        --control-slider-thickness: 10px;
        --mdc-icon-button-size: 30px;
        --mdc-icon-size: 20px;
      }

      *[slim] .volume-level {
        display: none;
      }

      .volume {
        display: flex;
        flex: 1;
      }

      .volume-slider {
        flex: 1;
        padding-right: 0.6rem;
      }

      *[slim] .volume-slider {
        display: flex;
        align-items: center;
      }

      .volume-level {
        font-size: x-small;
        display: flex;
      }

      .percentage {
        flex: 2;
      }

      .percentage,
      .percentage-slim {
        font-weight: bold;
        font-size: 12px;
        align-self: center;
      }

      *[hide] {
        display: none;
      }
    `;
  }
}

class SonosNoUiVerticalSlider extends LitElement {
  @property({ type: Number }) value = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Boolean }) disabled = false;

  private sliderEl?: HTMLDivElement;
  private slider?: noUiSlider.API;

  createRenderRoot() {
    return this;
  }

  firstUpdated() {
    console.log('SonosNoUiVerticalSlider firstUpdated');
    this.sliderEl = this.querySelector('.noui-vertical-slider') as HTMLDivElement;
    if (this.sliderEl) {
      console.log('Slider container found:', this.sliderEl);
      this.slider = noUiSlider.create(this.sliderEl, {
        start: [this.value],
        orientation: 'vertical',
        direction: 'rtl',
        range: {
          min: 0,
          max: this.max,
        },
        step: 1,
        connect: [true, false],
        tooltips: false,
      });
      setTimeout(() => {
        console.log('Slider classList:', this.sliderEl?.classList.value);
        console.log('Slider height:', this.sliderEl?.offsetHeight, 'width:', this.sliderEl?.offsetWidth);
      }, 500);
      this.slider.on('update', (values) => {
        const newValue = Math.round(Number(values[0]));
        if (newValue !== this.value) {
          this.value = newValue;
          this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: newValue } }));
        }
      });
      if (this.disabled) {
        this.sliderEl.setAttribute('disabled', 'true');
      } else {
        this.sliderEl.removeAttribute('disabled');
      }
    } else {
      console.warn('Slider container NOT found');
    }
  }

  updated(changedProps: Map<string, unknown>) {
    if (this.slider) {
      if (changedProps.has('value')) {
        this.slider.set([this.value]);
      }
      if (changedProps.has('max')) {
        this.slider.updateOptions({ range: { min: 0, max: this.max } });
      }
      if (changedProps.has('disabled')) {
        if (this.disabled) {
          this.sliderEl?.setAttribute('disabled', 'true');
        } else {
          this.sliderEl?.removeAttribute('disabled');
        }
      }
    }
  }

  render() {
    console.log('SonosNoUiVerticalSlider render', { value: this.value, max: this.max, disabled: this.disabled });
    return html`
      <div class="noui-vertical-slider" style="height: 120px; width: 32px;"></div>
      <div class="slider-value">${this.value}%</div>
    `;
  }

  static get styles() {
    return [
      css`
        /* Essential nouislider CSS for vertical slider */
        .noui-vertical-slider {
          margin: 0 auto;
          border: 2px solid red;
          background: rgba(255, 0, 0, 0.1);
        }
        .slider-value {
          margin-top: 0.3rem;
          color: #b48aff;
          font-size: 0.9rem;
          font-weight: bold;
          text-shadow: 0 1px 4px #000a;
          text-align: center;
        }
        .noUi-target {
          background: #222;
          border-radius: 4px;
          box-shadow: none;
          position: relative;
        }
        .noUi-base {
          width: 100%;
          height: 100%;
          position: absolute;
          left: 0;
          top: 0;
        }
        .noUi-connects {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: 1;
        }
        .noUi-connect {
          background: linear-gradient(180deg, #4f5bd5 0%, #b48aff 100%);
          border-radius: 4px;
        }
        .noUi-vertical {
          width: 32px;
          height: 120px;
        }
        .noUi-handle {
          position: absolute;
          z-index: 2;
          box-sizing: border-box;
          cursor: pointer;
          border-radius: 50%;
          background: #b48aff;
          border: 2px solid #fff;
          width: 28px;
          height: 28px;
          left: 2px;
          top: auto;
          bottom: 0;
          transform: translateY(50%);
        }
        .noUi-handle:after,
        .noUi-handle:before {
          display: none;
        }
        .noUi-tooltip {
          display: none;
        }
        .noUi-vertical .noUi-handle {
          left: 2px;
        }
        .noUi-vertical .noUi-origin {
          width: 100%;
        }
        .noUi-origin {
          position: absolute;
          right: 0;
          top: 0;
          left: 0;
          bottom: 0;
        }
      `,
    ];
  }
}

class SonosSimpleVerticalSlider extends LitElement {
  @property({ type: Number }) value = 50;
  @property({ type: Number }) max = 100;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Number }) tickCount = 10;

  private dragging = false;

  private get percent() {
    return Math.max(0, Math.min(1, this.value / this.max));
  }

  private onTrackClick(e: MouseEvent) {
    if (this.disabled) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percent = 1 - y / rect.height;
    const newValue = Math.round(percent * this.max);
    this.value = newValue;
    this.emitChange();
  }

  private onThumbMouseDown(e: MouseEvent) {
    if (this.disabled) return;
    this.dragging = true;
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    e.preventDefault();
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    const track = this.renderRoot.querySelector('.slider-track') as HTMLElement;
    const rect = track.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let percent = 1 - y / rect.height;
    percent = Math.max(0, Math.min(1, percent));
    this.value = Math.round(percent * this.max);
    this.emitChange();
  };

  private onMouseUp = (e: MouseEvent) => {
    if (this.dragging) {
      const track = this.renderRoot.querySelector('.slider-track') as HTMLElement;
      const rect = track.getBoundingClientRect();
      const y = e.clientY - rect.top;
      let percent = 1 - y / rect.height;
      percent = Math.max(0, Math.min(1, percent));
      this.value = Math.round(percent * this.max);
      this.emitChange();
    }
    this.dragging = false;
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  };

  private emitChange() {
    this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: this.value } }));
  }

  // Helper to interpolate between two colors
  private lerpColor(a: string, b: string, t: number): string {
    const ah = a.replace('#', '');
    const bh = b.replace('#', '');
    const ar = parseInt(ah.substring(0, 2), 16),
      ag = parseInt(ah.substring(2, 4), 16),
      ab = parseInt(ah.substring(4, 6), 16);
    const br = parseInt(bh.substring(0, 2), 16),
      bg = parseInt(bh.substring(2, 4), 16),
      bb = parseInt(bh.substring(4, 6), 16);
    const rr = ar + t * (br - ar);
    const rg = ag + t * (bg - ag);
    const rb = ab + t * (bb - ab);
    return `rgb(${rr.toFixed(0)},${rg.toFixed(0)},${rb.toFixed(0)})`;
  }

  render() {
    const ticks = Array.from({ length: this.tickCount + 1 }, (_, i) => i);
    const thumbY = this.percent * 100;
    return html`
      <div class="slider-outer">
        <div class="slider-track" @click=${this.onTrackClick}>
          ${ticks.map((i) => {
            const tickPercent = i / this.tickCount;
            const tickY = tickPercent * 100;
            // Color interpolation: 0% dark blue, 50% light blue, 100% dark purple
            let color = '#232a5c';
            if (tickPercent < 0.5) {
              color = this.lerpColor('#232a5c', '#4f8fff', tickPercent / 0.5);
            } else {
              color = this.lerpColor('#4f8fff', '#7d2fa6', (tickPercent - 0.5) / 0.5);
            }
            const active = tickPercent <= this.percent;
            return html`<div
              class="slider-tick"
              style="bottom: ${tickY}%; background: ${active ? color : '#23242a'}; opacity: ${active ? 1 : 0.4};"
            ></div>`;
          })}
          <div
            class="slider-thumb"
            style="bottom: ${thumbY}%;"
            @mousedown=${(e: MouseEvent) => {
              e.stopPropagation();
              this.onThumbMouseDown(e);
            }}
            tabindex="0"
            role="slider"
            aria-valuenow="${this.value}"
            aria-valuemax="${this.max}"
            aria-valuemin="0"
            aria-disabled="${this.disabled}"
          ></div>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .slider-outer {
        flex: 1 1 0;
        min-height: 0;
        width: 100%;
        max-width: 160px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: stretch;
        max-height: none;
        margin-top: 0;
        padding-top: 0;
      }
      .slider-track {
        position: relative;
        width: 48px;
        height: 100%;
        max-height: none;
        background: #111216;
        border-radius: 24px;
        box-shadow:
          0 2px 12px #000a inset,
          0 0 8px #000a;
        margin: 0 auto;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .slider-tick {
        position: absolute;
        left: 10%;
        width: 80%;
        height: 4px;
        border-radius: 2px;
        transition:
          background 0.2s,
          opacity 0.2s;
        z-index: 1;
      }
      .slider-thumb {
        position: absolute;
        left: 50%;
        transform: translate(-50%, 0);
        width: 96px;
        height: 72px;
        background: linear-gradient(180deg, #e0e0e0 0%, #bdbdbd 40%, #888 60%, #444 100%);
        border-radius: 8px;
        box-shadow:
          0 4px 16px #000c,
          0 0 0 2px #23242a;
        border: 2px solid #444;
        z-index: 2;
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: box-shadow 0.2s;
      }
      .slider-thumb::before {
        content: '';
        display: block;
        position: absolute;
        left: 16px;
        right: 16px;
        top: 32px;
        height: 4px;
        background: linear-gradient(90deg, #fff 0%, #bbb 100%);
        opacity: 0.7;
        border-radius: 1px;
      }
      .slider-thumb:active {
        box-shadow:
          0 4px 16px #000c,
          0 0 0 2px #b48aff;
        background: linear-gradient(180deg, #fff 0%, #aaa 100%);
      }
      .slider-track:active .slider-thumb {
        box-shadow:
          0 4px 16px #000c,
          0 0 0 2px #b48aff;
      }
    `;
  }
}

function numberFromEvent(e: Event) {
  return Number.parseInt((e?.target as HTMLInputElement)?.value);
}

customElements.define('sonos-volume', Volume);
customElements.define('sonos-noui-vertical-slider', SonosNoUiVerticalSlider);
customElements.define('sonos-simple-vertical-slider', SonosSimpleVerticalSlider);
