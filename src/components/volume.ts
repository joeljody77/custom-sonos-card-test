import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import MediaControlService from '../services/media-control-service';
import Store from '../model/store';
import { CardConfig } from '../types';
import { mdiVolumeHigh, mdiVolumeMute } from '@mdi/js';
import { MediaPlayer } from '../model/media-player';

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

    const isMuted = this.updateMembers ? this.player.isGroupMuted() : this.player.isMemberMuted();
    const muteIcon = isMuted ? mdiVolumeMute : mdiVolumeHigh;
    const disabled = this.player.ignoreVolume;

    // Use vertical slider if orientation is vertical
    if (this.orientation === 'vertical') {
      return html`
        <sonos-vertical-slider
          .value=${volume}
          .max=${max}
          .disabled=${disabled}
          .tickCount=${10}
          @value-changed=${this.volumeChanged}
        ></sonos-vertical-slider>
      `;
    }

    return html`
      <div class="volume" slim=${this.slim || nothing}>
        <ha-icon-button .disabled=${disabled} @click=${this.mute} .path=${muteIcon}> </ha-icon-button>
        <div class="volume-slider">
          <ha-control-slider
            .value=${volume}
            max=${max}
            @value-changed=${this.volumeChanged}
            .disabled=${disabled}
            class=${this.config.dynamicVolumeSlider && max === 100 ? 'over-threshold' : ''}
          ></ha-control-slider>
          <div class="volume-level">
            <div style="flex: ${volume}">0%</div>
            <div class="percentage">${volume}%</div>
            <div style="flex: ${max - volume};text-align: right">${max}%</div>
          </div>
        </div>
        <div class="percentage-slim" hide=${this.slim && nothing}>${volume}%</div>
        <sonos-ha-player .store=${this.store} .features=${this.store.showPower()}></sonos-ha-player>
      </div>
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

class SonosVerticalSlider extends LitElement {
  @property({ type: Number }) value = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Number }) tickCount = 10;

  private onInput(e: Event) {
    const newValue = Number((e.target as HTMLInputElement).value);
    this.value = newValue;
    this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: newValue } }));
  }

  render() {
    const ticks = Array.from({ length: this.tickCount + 1 }, (_, i) => i);
    return html`
      <div class="vertical-slider-container">
        <div class="slider-track">
          <input
            type="range"
            min="0"
            max="${this.max}"
            .value="${String(this.value)}"
            ?disabled="${this.disabled}"
            class="vertical-slider"
            @input="${this.onInput}"
            orient="vertical"
          />
          <div class="slider-ticks">
            ${ticks.map(
              (i) =>
                html`<div
                  class="slider-tick"
                  style="bottom: ${(i / this.tickCount) *
                  100}%; background: linear-gradient(90deg, #4f5bd5, #b48aff); opacity: ${i / this.tickCount};"
                ></div>`,
            )}
          </div>
        </div>
        <div class="slider-value">${this.value}%</div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .vertical-slider-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 140px;
        width: 32px;
        position: relative;
      }
      .slider-track {
        position: relative;
        height: 120px;
        width: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .vertical-slider {
        writing-mode: bt-lr;
        -webkit-appearance: slider-vertical;
        width: 32px;
        height: 120px;
        background: linear-gradient(180deg, #4f5bd5 0%, #b48aff 100%);
        border-radius: 8px;
        outline: none;
        accent-color: #b48aff;
        z-index: 2;
      }
      .vertical-slider:disabled {
        opacity: 0.5;
      }
      .slider-ticks {
        position: absolute;
        left: 50%;
        top: 0;
        width: 100%;
        height: 100%;
        transform: translateX(-50%);
        z-index: 1;
        pointer-events: none;
      }
      .slider-tick {
        position: absolute;
        left: 0;
        width: 100%;
        height: 2px;
        border-radius: 1px;
        background: #b48aff;
        opacity: 0.5;
      }
      .slider-value {
        margin-top: 0.3rem;
        color: #b48aff;
        font-size: 0.9rem;
        font-weight: bold;
        text-shadow: 0 1px 4px #000a;
      }
    `;
  }
}

function numberFromEvent(e: Event) {
  return Number.parseInt((e?.target as HTMLInputElement)?.value);
}

customElements.define('sonos-volume', Volume);
customElements.define('sonos-vertical-slider', SonosVerticalSlider);
