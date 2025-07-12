import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import MediaControlService from '../services/media-control-service';
import Store from '../model/store';
import { CardConfig, MediaPlayerEntityFeature } from '../types';
import { mdiFastForward, mdiRewind, mdiVolumeMinus, mdiVolumePlus } from '@mdi/js';
import { MediaPlayer } from '../model/media-player';
import { until } from 'lit-html/directives/until.js';
import { findPlayer } from '../utils/utils';

const { SHUFFLE_SET, REPEAT_SET, PLAY, PAUSE, NEXT_TRACK, PREVIOUS_TRACK, BROWSE_MEDIA, STOP } =
  MediaPlayerEntityFeature;

class PlayerControls extends LitElement {
  @property({ attribute: false }) store!: Store;
  private config!: CardConfig;
  private activePlayer!: MediaPlayer;
  private mediaControlService!: MediaControlService;
  private volumePlayer!: MediaPlayer;
  private updateMemberVolumes!: boolean;

  render() {
    this.config = this.store.config;
    this.activePlayer = this.store.activePlayer;
    this.mediaControlService = this.store.mediaControlService;
    const noUpDown = !!this.config.showVolumeUpAndDownButtons && nothing;
    const noFastForwardAndRewind = !!this.config.showFastForwardAndRewindButtons && nothing;
    this.volumePlayer = this.getVolumePlayer();
    this.updateMemberVolumes = !this.config.playerVolumeEntityId;
    const pauseOrStop = this.config.stopInsteadOfPause ? STOP : PAUSE;
    return html`
      <div class="main" id="mediaControls">
          <div class="icons">
              <div class="flex-1"></div>
              <ha-icon-button hide=${noUpDown} @click=${this.volDown} .path=${mdiVolumeMinus}></ha-icon-button>
              <sonos-ha-player .store=${this.store} .features=${this.showShuffle()}></sonos-ha-player>
              <sonos-ha-player .store=${this.store} .features=${this.showPrev()}></sonos-ha-player>
              <ha-icon-button hide=${noFastForwardAndRewind} @click=${this.rewind} .path=${mdiRewind}></ha-icon-button>
              <sonos-ha-player .store=${this.store} .features=${[PLAY, pauseOrStop]} class="big-icon"></sonos-ha-player>
              <ha-icon-button hide=${noFastForwardAndRewind} @click=${this.fastForward} .path=${mdiFastForward}></ha-icon-button>
              <sonos-ha-player .store=${this.store} .features=${this.showNext()}></sonos-ha-player>
              <sonos-ha-player .store=${this.store} .features=${this.showRepeat()}></sonos-ha-player>
              <ha-icon-button hide=${noUpDown} @click=${this.volUp} .path=${mdiVolumePlus}></ha-icon-button>
              <div class="audio-input-format">
                ${this.config.showAudioInputFormat && until(this.getAudioInputFormat())}
              </div>
              <sonos-ha-player .store=${this.store} .features=${this.showBrowseMedia()}></sonos-ha-player>
          </div>
          <sonos-volume .store=${this.store} .player=${this.volumePlayer}
                       .updateMembers=${this.updateMemberVolumes}></sonos-volume>
          <div class="icons">
              <sonos-ha-player .store=${this.store} .features=${this.store.showPower(true)}></sonos-ha-player>
          </div">
      </div>
  `;
  }

  private getVolumePlayer() {
    let result;
    if (this.config.playerVolumeEntityId) {
      if (this.config.allowPlayerVolumeEntityOutsideOfGroup) {
        result = findPlayer(this.store.allMediaPlayers, this.config.playerVolumeEntityId);
      } else {
        result = this.activePlayer.getMember(this.config.playerVolumeEntityId);
      }
    }
    return result ?? this.activePlayer;
  }

  private volDown = async () => await this.mediaControlService.volumeDown(this.volumePlayer, this.updateMemberVolumes);
  private volUp = async () => await this.mediaControlService.volumeUp(this.volumePlayer, this.updateMemberVolumes);
  private rewind = async () =>
    await this.mediaControlService.seek(
      this.activePlayer,
      this.activePlayer.attributes.media_position - (this.config.fastForwardAndRewindStepSizeSeconds || 15),
    );
  private fastForward = async () =>
    await this.mediaControlService.seek(
      this.activePlayer,
      this.activePlayer.attributes.media_position + (this.config.fastForwardAndRewindStepSizeSeconds || 15),
    );

  private async getAudioInputFormat() {
    const sensors = await this.store.hassService.getRelatedEntities(this.activePlayer, 'sensor');
    const audioInputFormat = sensors.find((sensor) => sensor.entity_id.includes('audio_input_format'));
    return audioInputFormat && audioInputFormat.state && audioInputFormat.state !== 'No audio'
      ? html`<div>${audioInputFormat.state}</div>`
      : '';
  }

  private showShuffle() {
    return this.config.hidePlayerControlShuffleButton ? [] : [SHUFFLE_SET];
  }

  private showPrev() {
    return this.config.hidePlayerControlPrevTrackButton ? [] : [PREVIOUS_TRACK];
  }

  private showNext() {
    return this.config.hidePlayerControlNextTrackButton ? [] : [NEXT_TRACK];
  }

  private showRepeat() {
    return this.config.hidePlayerControlRepeatButton ? [] : [REPEAT_SET];
  }

  private showBrowseMedia() {
    return this.config.showBrowseMediaInPlayerSection ? [BROWSE_MEDIA] : [];
  }

  static get styles() {
    return css`
      .main {
        overflow: hidden auto;
        padding: 16px 0;
      }
      .icons {
        justify-content: center;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      *[hide] {
        display: none;
      }
      .big-icon {
        --mdc-icon-button-size: 5rem;
        --mdc-icon-size: 5rem;
        position: relative;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .big-icon::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, #e9456022 0%, transparent 70%);
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      .big-icon:hover::before {
        opacity: 1;
        animation: buttonPulse 2s ease-in-out infinite;
      }
      @keyframes buttonPulse {
        0%, 100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.3;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.1);
          opacity: 0.6;
        }
      }
      ha-icon-button {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 50%;
        position: relative;
        overflow: hidden;
      }
      ha-icon-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(circle at center, #4f8fff22 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
      }
      ha-icon-button:hover::before {
        opacity: 1;
      }
      ha-icon-button:hover {
        transform: scale(1.1);
        box-shadow: 
          0 4px 16px #4f8fff44,
          0 0 0 1px #4f8fff;
      }
      ha-icon-button:active {
        transform: scale(0.95);
        transition: transform 0.1s;
      }
      .audio-input-format {
        flex: 1 0 0;
        margin-bottom: 10px;
        text-align: center;
        align-self: stretch;
        position: relative;
      }
      .audio-input-format > div {
        color: var(--card-background-color);
        background: linear-gradient(135deg, #e94560 0%, #4f8fff 100%);
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        position: absolute;
        bottom: 0;
        right: 0;
        max-width: 100%;
        font-size: smaller;
        line-height: normal;
        padding: 6px 12px;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: 
          0 2px 8px #e9456044,
          0 0 0 1px #e94560;
        animation: formatGlow 3s ease-in-out infinite;
      }
      @keyframes formatGlow {
        0%, 100% {
          box-shadow: 
            0 2px 8px #e9456044,
            0 0 0 1px #e94560;
        }
        50% {
          box-shadow: 
            0 4px 16px #e9456066,
            0 0 0 1px #e94560,
            0 0 0 2px #4f8fff44;
        }
      }
      .flex-1 {
        flex: 1;
      }
    `;
  }
}

customElements.define('sonos-player-controls', PlayerControls);
